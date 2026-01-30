<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessRedeemFulfillment;
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
    public function index(Request $request)
    {
        $orders = $request->user()->orders()->with(['orderItems.product', 'payment'])->latest()->paginate(20);
        return response()->json($orders);
    }

    public function show(Request $request, Order $order)
    {
        if ($order->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $order->load(['orderItems.product', 'payment']);
        return response()->json($order);
    }

    public function redeemCodes(Request $request, Order $order)
    {
        if ($order->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $order->loadMissing('orderItems');
        $hasRedeemItems = $order->requiresRedeemFulfillment();

        if (!in_array($order->status, ['paid', 'fulfilled', 'paid_but_out_of_stock'], true)) {
            return response()->json([
                'status' => $order->status,
                'codes' => [],
                'has_redeem_items' => $hasRedeemItems,
            ]);
        }

        if ($order->status === 'paid_but_out_of_stock') {
            return response()->json([
                'status' => $order->status,
                'codes' => [],
                'has_redeem_items' => $hasRedeemItems,
            ]);
        }

        $deliveries = RedeemCodeDelivery::with(['redeemCode.denomination'])
            ->where('order_id', $order->id)
            ->orderBy('id')
            ->get();

        // Self-heal: if payment is confirmed but codes haven't been allocated yet (e.g. no worker),
        // attempt synchronous fulfillment once, then reload deliveries.
        if ($hasRedeemItems && $deliveries->isEmpty() && in_array($order->status, ['paid', 'fulfilled'], true)) {
            try {
                ProcessRedeemFulfillment::dispatchSync($order->id);
            } catch (\Throwable $e) {
                // Don't block the client: they can retry or request resend.
            }

            $order->refresh();
            if ($order->status === 'paid_but_out_of_stock') {
                return response()->json([
                    'status' => $order->status,
                    'codes' => [],
                    'has_redeem_items' => $hasRedeemItems,
                ]);
            }

            $deliveries = RedeemCodeDelivery::with(['redeemCode.denomination'])
                ->where('order_id', $order->id)
                ->orderBy('id')
                ->get();
        }

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
            'status' => $order->status,
            'codes' => $codes,
            'guide_url' => url('/api/guides/shop2game-freefire'),
            'has_redeem_items' => $hasRedeemItems,
        ]);
    }

    public function resendRedeemCodes(Request $request, Order $order)
    {
        if ($order->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $order->loadMissing(['user', 'orderItems']);

        if (!$order->requiresRedeemFulfillment()) {
            return response()->json(['message' => 'Order does not contain redeem codes'], 422);
        }

        if (!in_array($order->status, ['paid', 'fulfilled'], true)) {
            return response()->json(['message' => 'Codes not available yet'], 422);
        }

        $deliveries = RedeemCodeDelivery::with(['redeemCode.denomination'])
            ->where('order_id', $order->id)
            ->orderBy('id')
            ->get();

        $redeemCodes = $deliveries
            ->map(fn ($delivery) => $delivery->redeemCode)
            ->filter()
            ->values();

        if ($redeemCodes->isEmpty()) {
            return response()->json(['message' => 'No codes assigned'], 404);
        }

        $email = trim((string) ($order->user?->email ?? ''));
        if ($email === '') {
            return response()->json(['message' => 'Email missing'], 422);
        }

        // Send synchronously to avoid relying on queue workers.
        Mail::to($email)->send(new \App\Mail\RedeemCodeDelivery($order->loadMissing('user'), $redeemCodes->all()));

        RedeemCode::whereIn('id', $redeemCodes->pluck('id')->all())->update(['last_resend_at' => now()]);

        \App\Models\EmailLog::create([
            'user_id' => $order->user_id,
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

            if ($product->redeem_code_delivery && !$denominationId) {
                $denominationId = RedeemDenomination::where('product_id', $product->id)
                    ->where('active', true)
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

                if ($availableCodes < $quantity) {
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
                'status' => 'pending',
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