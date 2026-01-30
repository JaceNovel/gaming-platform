<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\OrderItem;
use App\Models\RedeemDenomination;
use App\Models\RedeemCode;
use App\Models\RedeemCodeDelivery;
use App\Models\Coupon;
use App\Services\ShippingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    private function resolveOrderForUser(Request $request, string $orderIdOrReference): Order
    {
        $needle = urldecode($orderIdOrReference);

        $order = Order::query()
            ->where('user_id', $request->user()->id)
            ->where(function ($q) use ($needle) {
                if (ctype_digit($needle)) {
                    $q->where('id', (int) $needle)->orWhere('reference', $needle);
                } else {
                    $q->where('reference', $needle);
                }
            })
            ->first();

        if (!$order) {
            abort(404, 'Commande introuvable');
        }

        return $order;
    }

    private function attachRedeemDenominationsIfMissing(Order $order): bool
    {
        $order->loadMissing(['orderItems.product']);

        $updated = false;

        foreach ($order->orderItems as $orderItem) {
            if (!empty($orderItem->redeem_denomination_id)) {
                continue;
            }

            $product = $orderItem->product;
            if (!$product) {
                continue;
            }

            $requiresDenomination = ($product->stock_mode ?? 'manual') === 'redeem_pool'
                || (bool) ($product->redeem_code_delivery ?? false)
                || strtolower((string) ($product->type ?? '')) === 'redeem';

            if (!$requiresDenomination) {
                continue;
            }

            $quantity = max(1, (int) ($orderItem->quantity ?? 1));

            $denominations = RedeemDenomination::query()
                ->where('active', true)
                ->where(function ($q) use ($product) {
                    $q->where('product_id', $product->id)->orWhereNull('product_id');
                })
                ->orderByRaw('CASE WHEN product_id IS NULL THEN 1 ELSE 0 END')
                ->orderByDesc('diamonds')
                ->get();

            foreach ($denominations as $denomination) {
                $available = RedeemCode::where('denomination_id', $denomination->id)
                    ->where('status', 'available')
                    ->count();

                if ($available >= $quantity) {
                    $orderItem->update(['redeem_denomination_id' => $denomination->id]);
                    $updated = true;
                    break;
                }
            }
        }

        return $updated;
    }

    public function index(Request $request)
    {
        $includeTopups = filter_var((string) $request->query('include_wallet_topups', '0'), FILTER_VALIDATE_BOOLEAN);

        $query = $request->user()
            ->orders()
            ->with(['orderItems.product', 'payment'])
            ->latest();

        if (!$includeTopups) {
            $query->where('type', '!=', 'wallet_topup');
        }

        $orders = $query->paginate(20);

        $orders->getCollection()->transform(function (Order $order) {
            $order->setAttribute('has_redeem_items', $order->requiresRedeemFulfillment());
            return $order;
        });

        return response()->json($orders);
    }

    public function show(Request $request, string $order)
    {
        $orderModel = $this->resolveOrderForUser($request, $order);
        $orderModel->load(['orderItems.product', 'payment']);
        return response()->json($orderModel);
    }

    public function redeemCodes(Request $request, string $order)
    {
        $orderModel = $this->resolveOrderForUser($request, $order);

        $orderModel->loadMissing('orderItems');
        $hasRedeemItems = $orderModel->requiresRedeemFulfillment();

        if (!$orderModel->isPaymentSuccess()) {
            return response()->json([
                'status' => $orderModel->status,
                'codes' => [],
                'has_redeem_items' => $hasRedeemItems,
            ]);
        }

        // Self-heal (legacy): older paid orders may miss redeem_denomination_id even though the product uses redeem_pool.
        if (!$hasRedeemItems) {
            $updated = $this->attachRedeemDenominationsIfMissing($orderModel);
            if ($updated) {
                $orderModel->refresh();
                $orderModel->loadMissing('orderItems');
                $hasRedeemItems = $orderModel->requiresRedeemFulfillment();
            }
        }

        $deliveries = RedeemCodeDelivery::with(['redeemCode.denomination'])
            ->where('order_id', $orderModel->id)
            ->orderBy('id')
            ->get();

        // Delivery is webhook-only. If there are no deliveries yet, the client will simply see an empty list.

        $codes = $deliveries->map(fn ($delivery) => [
            'code' => $delivery->redeemCode?->code,
            'label' => $delivery->redeemCode?->denomination?->label,
            'diamonds' => $delivery->redeemCode?->denomination?->diamonds,
            'quantity_index' => $delivery->quantity_index,
        ])->filter(fn ($row) => !empty($row['code']))->values();

        RedeemCodeDelivery::whereIn('id', $deliveries->pluck('id'))
            ->where('delivered_via', 'email')
            ->update(['delivered_via' => 'both']);

        RedeemCode::whereIn('id', $deliveries->pluck('redeem_code_id'))
            ->whereNull('revealed_at')
            ->update(['revealed_at' => now()]);

        return response()->json([
            'status' => $orderModel->status,
            'codes' => $codes,
            'guide_url' => url('/api/guides/shop2game-freefire'),
            'has_redeem_items' => $hasRedeemItems,
        ]);
    }

    public function resendRedeemCodes(Request $request, string $order)
    {
        $orderModel = $this->resolveOrderForUser($request, $order);

        // Try to self-heal missing denominations before resend.
        $this->attachRedeemDenominationsIfMissing($orderModel);
        $orderModel->refresh();

        $orderModel->loadMissing(['user', 'orderItems']);

        if (!$orderModel->requiresRedeemFulfillment()) {
            return response()->json(['message' => 'Order does not contain redeem codes'], 422);
        }

        if (!$orderModel->isPaymentSuccess()) {
            return response()->json(['message' => 'Codes not available yet'], 422);
        }

        $deliveries = RedeemCodeDelivery::with(['redeemCode.denomination'])
            ->where('order_id', $orderModel->id)
            ->orderBy('id')
            ->get();

        $redeemCodes = $deliveries
            ->map(fn ($delivery) => $delivery->redeemCode)
            ->filter()
            ->values();

        if ($redeemCodes->isEmpty()) {
            return response()->json(['message' => 'No codes assigned'], 404);
        }

        $email = trim((string) ($orderModel->user?->email ?? ''));
        if ($email === '') {
            return response()->json(['message' => 'Email missing'], 422);
        }

        // Send synchronously to avoid relying on queue workers.
        Mail::to($email)->send(new \App\Mail\RedeemCodeDelivery($orderModel->loadMissing('user'), $redeemCodes->all()));

        RedeemCode::whereIn('id', $redeemCodes->pluck('id')->all())->update(['last_resend_at' => now()]);

        \App\Models\EmailLog::create([
            'user_id' => $orderModel->user_id,
            'to' => $email,
            'type' => 'redeem_code_resend',
            'subject' => 'Votre recharge Free Fire est prête',
            'status' => 'sent',
            'sent_at' => now(),
        ]);

        return response()->json(['message' => 'Codes envoyés par email.']);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'nullable|integer|min:1',
            'items.*.qty' => 'nullable|integer|min:1',
            'items.*.game_id' => 'nullable|string|max:255',
            'items.*.redeem_denomination_id' => 'nullable|exists:redeem_denominations,id',
            'shipping_address_line1' => 'nullable|string|max:255',
            'shipping_city' => 'nullable|string|max:80',
            'shipping_country_code' => 'nullable|string|max:2',
            'shipping_phone' => 'nullable|string|max:32',
        ]);

        $user = $request->user();
        $totalAmount = 0;
        $validatedItems = [];
        $requiresRedeemFulfillment = false;
        $hasPhysicalItems = false;

        foreach ($data['items'] as $item) {
            $quantity = $item['quantity'] ?? $item['qty'] ?? null;

            if (!$quantity) {
                throw ValidationException::withMessages([
                    'items' => 'Quantity is required for each item',
                ]);
            }

            $product = Product::findOrFail($item['product_id']);
            $denominationId = $item['redeem_denomination_id'] ?? null;
            $redeemDenomination = null;

            $gameId = trim((string) ($item['game_id'] ?? ''));
            if ($product->type === 'subscription' && $gameId === '') {
                throw ValidationException::withMessages([
                    'items' => "Game ID is required for {$product->name}",
                ]);
            }

            if (!$product->is_active) {
                throw ValidationException::withMessages([
                    'items' => "Product {$product->name} is not available",
                ]);
            }

            if ($product->type === 'account' && $product->stock < $quantity) {
                throw ValidationException::withMessages([
                    'items' => "Product {$product->name} is out of stock",
                ]);
            }

            $requiresDenomination = ($product->stock_mode ?? 'manual') === 'redeem_pool'
                || (bool) $product->redeem_code_delivery
                || strtolower((string) ($product->type ?? '')) === 'redeem';

            if ($requiresDenomination && !$denominationId) {
                $denominationId = RedeemDenomination::where('active', true)
                    ->where(function ($q) use ($product) {
                        $q->whereNull('product_id')->orWhere('product_id', $product->id);
                    })
                    ->orderByDesc('diamonds')
                    ->value('id');
            }

            if (($product->stock_mode ?? 'manual') === 'redeem_pool' || $product->redeem_code_delivery) {
                    if ($quantity > 1) {
                        // Allow multi-quantity for redeem code delivery.
                }
                if (!$denominationId) {
                    throw ValidationException::withMessages([
                        'items' => "Denomination is required for {$product->name}",
                    ]);
                }

                $redeemDenomination = RedeemDenomination::where('id', $denominationId)
                    ->when($product->id, fn ($query) => $query->where(function ($q) use ($product) {
                        $q->whereNull('product_id')->orWhere('product_id', $product->id);
                    }))
                    ->first();

                if (!$redeemDenomination || !$redeemDenomination->active) {
                    throw ValidationException::withMessages([
                        'items' => 'Selected denomination is not available',
                    ]);
                }

                $availableCodes = RedeemCode::where('denomination_id', $redeemDenomination->id)
                    ->where('status', 'available')
                    ->count();

                $isPreorder = strtoupper((string) ($product->stock_type ?? '')) === 'PREORDER'
                    || strtolower((string) ($product->delivery_type ?? '')) === 'preorder';

                if ($availableCodes < $quantity && !$isPreorder) {
                    throw ValidationException::withMessages([
                        'items' => 'Selected denomination is low on stock, please try a lower quantity',
                    ]);
                }

                $requiresRedeemFulfillment = true;
            }

            $unitPrice = $product->discount_price ?? $product->price;
            $lineTotal = $unitPrice * $quantity;
            $totalAmount += $lineTotal;

            $isPhysical = (bool) ($product->shipping_required ?? false);
            if ($isPhysical) {
                $hasPhysicalItems = true;
            }

            $deliveryType = $product->delivery_type;
            if (!$deliveryType && !empty($product->stock_type)) {
                $deliveryType = strtoupper((string) $product->stock_type) === 'PREORDER' ? 'preorder' : 'in_stock';
            }
            if (!$deliveryType && $isPhysical) {
                $deliveryType = 'in_stock';
            }

            $deliveryEtaDays = $product->delivery_eta_days;
            if (!$deliveryEtaDays && $isPhysical) {
                $deliveryEtaDays = $deliveryType === 'preorder' ? 14 : 2;
            }

            $validatedItems[] = [
                'product_id' => $product->id,
                'redeem_denomination_id' => $redeemDenomination->id ?? null,
                'quantity' => $quantity,
                'price' => $unitPrice,
                'game_id' => $item['game_id'] ?? null,
                'type' => $product->type,
                'is_physical' => $isPhysical,
                'delivery_type' => $deliveryType,
                'delivery_eta_days' => $deliveryEtaDays,
            ];
        }

        $order = DB::transaction(function () use ($data, $user, $validatedItems, $totalAmount, $requiresRedeemFulfillment, $hasPhysicalItems) {
            $promotionSummary = $this->buildPromotionSummary($user, $totalAmount);
            $finalTotal = max(0, $totalAmount - $promotionSummary['total_discount']);

            $payload = [
                'user_id' => $user->id,
                'type' => $requiresRedeemFulfillment ? 'redeem_purchase' : 'purchase',
                'total_price' => $finalTotal,
                'status' => Order::STATUS_PAYMENT_PROCESSING,
                'items' => $validatedItems,
                'meta' => $requiresRedeemFulfillment
                    ? array_merge(['requires_redeem' => true], $promotionSummary['meta'])
                    : $promotionSummary['meta'],
                'reference' => 'ORD-' . strtoupper(uniqid()),
                'shipping_address_line1' => $data['shipping_address_line1'] ?? null,
                'shipping_city' => $data['shipping_city'] ?? null,
                'shipping_country_code' => $data['shipping_country_code'] ?? null,
                'shipping_phone' => $data['shipping_phone'] ?? null,
            ];

            if ($hasPhysicalItems) {
                $payload['shipping_status'] = 'pending';
            }

            $order = Order::create($payload);

            foreach ($validatedItems as $item) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $item['product_id'],
                    'redeem_denomination_id' => $item['redeem_denomination_id'] ?? null,
                    'quantity' => $item['quantity'],
                    'price' => $item['price'],
                    'game_user_id' => $item['game_id'],
                    'delivery_status' => 'pending',
                    'is_physical' => $item['is_physical'] ?? false,
                    'delivery_type' => $item['delivery_type'] ?? null,
                    'delivery_eta_days' => $item['delivery_eta_days'] ?? null,
                ]);
            }

            if (!empty($promotionSummary['applied_ids'])) {
                Coupon::whereIn('id', $promotionSummary['applied_ids'])
                    ->increment('uses_count');
            }

            return $order;
        });

        if ($hasPhysicalItems) {
            app(ShippingService::class)->computeShippingForOrder($order);
        }

        return response()->json([
            'order' => $order->load('orderItems.product'),
            'message' => 'Order created successfully'
        ], 201);
    }

    private function buildPromotionSummary($user, float $totalAmount): array
    {
        $vipPercent = $this->vipDiscountPercent($user);

        $promotions = Coupon::query()
            ->where('is_active', true)
            ->where(function ($query) {
                $query->whereNull('starts_at')
                    ->orWhere('starts_at', '<=', now());
            })
            ->where(function ($query) {
                $query->whereNull('ends_at')
                    ->orWhere('ends_at', '>=', now())
                    ->orWhere(function ($sub) {
                        $sub->whereNull('ends_at')
                            ->whereNotNull('expires_at')
                            ->where('expires_at', '>=', now());
                    });
            })
            ->where(function ($query) {
                $query->whereNull('max_uses')
                    ->orWhereColumn('uses_count', '<', 'max_uses');
            })
            ->get();

        $promoPercent = 0.0;
        $promoFixed = 0.0;
        $appliedCodes = [];
        $appliedIds = [];

        foreach ($promotions as $promotion) {
            $appliedCodes[] = $promotion->code;
            $appliedIds[] = $promotion->id;
            if (($promotion->type ?? 'percent') === 'fixed') {
                $promoFixed += (float) ($promotion->discount_value ?? 0);
            } else {
                $promoPercent += (float) ($promotion->discount_percent ?? 0);
            }
        }

        $totalPercent = $promoPercent + $vipPercent;
        $percentDiscount = $totalAmount * ($totalPercent / 100);
        $totalDiscount = min($totalAmount, $percentDiscount + $promoFixed);

        return [
            'total_discount' => $totalDiscount,
            'applied_ids' => $appliedIds,
            'meta' => [
                'promotion' => [
                    'vip_percent' => $vipPercent,
                    'promo_percent' => $promoPercent,
                    'promo_fixed' => $promoFixed,
                    'total_discount' => round($totalDiscount, 2),
                    'applied_codes' => $appliedCodes,
                ],
            ],
        ];
    }

    private function vipDiscountPercent($user): float
    {
        if (!$user?->is_premium) {
            return 0.0;
        }

        return match ((int) ($user->premium_level ?? 1)) {
            3 => 7.0,
            2 => 5.0,
            default => 3.0,
        };
    }
}