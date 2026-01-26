<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\OrderItem;
use App\Models\RedeemDenomination;
use App\Models\RedeemCode;
use App\Models\Coupon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

    public function store(Request $request)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'nullable|integer|min:1',
            'items.*.qty' => 'nullable|integer|min:1',
            'items.*.game_id' => 'nullable|string|max:255',
            'items.*.redeem_denomination_id' => 'nullable|exists:redeem_denominations,id',
        ]);

        $user = $request->user();
        $totalAmount = 0;
        $validatedItems = [];
        $requiresRedeemFulfillment = false;

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

            $requiresGameId = in_array($product->type, ['recharge', 'subscription', 'topup', 'pass'], true);
            if ($requiresGameId && empty($item['game_id'])) {
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

            if (($product->stock_mode ?? 'manual') === 'redeem_pool') {
                if ($quantity > 1) {
                    throw ValidationException::withMessages([
                        'items' => 'Redeem products must be purchased one at a time',
                    ]);
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

            $validatedItems[] = [
                'product_id' => $product->id,
                'redeem_denomination_id' => $redeemDenomination->id ?? null,
                'quantity' => $quantity,
                'price' => $unitPrice,
                'game_id' => $item['game_id'] ?? null,
                'type' => $product->type,
            ];
        }

        $order = DB::transaction(function () use ($user, $validatedItems, $totalAmount, $requiresRedeemFulfillment) {
            $promotionSummary = $this->buildPromotionSummary($user, $totalAmount);
            $finalTotal = max(0, $totalAmount - $promotionSummary['total_discount']);

            $order = Order::create([
                'user_id' => $user->id,
                'type' => $requiresRedeemFulfillment ? 'redeem_purchase' : 'purchase',
                'total_price' => $finalTotal,
                'status' => 'pending',
                'items' => $validatedItems,
                'meta' => $requiresRedeemFulfillment
                    ? array_merge(['requires_redeem' => true], $promotionSummary['meta'])
                    : $promotionSummary['meta'],
                'reference' => 'ORD-' . strtoupper(uniqid()),
            ]);

            foreach ($validatedItems as $item) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $item['product_id'],
                    'redeem_denomination_id' => $item['redeem_denomination_id'] ?? null,
                    'quantity' => $item['quantity'],
                    'price' => $item['price'],
                    'game_user_id' => $item['game_id'],
                    'delivery_status' => 'pending',
                ]);

                Product::where('id', $item['product_id'])->increment('purchases_count');
                Product::where('id', $item['product_id'])->increment('sold_count', $item['quantity']);
            }

            if (!empty($promotionSummary['applied_ids'])) {
                Coupon::whereIn('id', $promotionSummary['applied_ids'])
                    ->increment('uses_count');
            }

            return $order;
        });

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