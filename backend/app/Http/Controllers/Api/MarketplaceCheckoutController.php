<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\SellerListing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use App\Services\MarketplaceCommissionService;

class MarketplaceCheckoutController extends Controller
{
    public function checkout(Request $request, SellerListing $sellerListing)
    {
        $user = $request->user();

        if ($sellerListing->status !== 'active' || $sellerListing->sold_at || $sellerListing->order_id) {
            return response()->json(['message' => 'Listing not available.'], 404);
        }

        $now = now();

        /** @var MarketplaceCommissionService $commissionService */
        $commissionService = app(MarketplaceCommissionService::class);

        $order = DB::transaction(function () use ($sellerListing, $user, $now, $commissionService) {
            $listing = SellerListing::query()->lockForUpdate()->findOrFail($sellerListing->id);
            $listing->loadMissing('seller');

            if ($listing->status !== 'active' || $listing->sold_at || $listing->order_id) {
                throw ValidationException::withMessages([
                    'listing' => ['Listing not available.'],
                ]);
            }

            if ($listing->reserved_until && $listing->reserved_until->isFuture()) {
                throw ValidationException::withMessages([
                    'listing' => ['Listing is currently reserved. Please try again later.'],
                ]);
            }

            $seller = $listing->seller;
            if (!$seller || $seller->status !== 'approved' || $seller->partner_wallet_frozen) {
                throw ValidationException::withMessages([
                    'seller' => ['Seller is not eligible.'],
                ]);
            }

            $price = (float) $listing->price;
            $commission = (float) $commissionService->resolveCommissionForListing($listing->category_id, $price);

            $order = Order::create([
                'user_id' => $user->id,
                'type' => 'marketplace_gaming_account',
                'status' => Order::STATUS_PAYMENT_PROCESSING,
                'total_price' => $price,
                'reference' => 'MP-' . strtoupper(Str::random(10)),
                'items' => [],
                'meta' => [
                    'seller_listing_id' => $listing->id,
                    'commission_amount' => $commission,
                    'marketplace' => [
                        'seller_listing_id' => $listing->id,
                        'commission_amount' => $commission,
                        'price' => $price,
                    ],
                ],
            ]);

            $listing->reserved_order_id = $order->id;
            $listing->reserved_until = $now->copy()->addMinutes(20);
            $listing->save();

            return $order;
        });

        return response()->json([
            'ok' => true,
            'order' => $order,
            'reserved_until' => $sellerListing->fresh()->reserved_until?->toIso8601String(),
        ], 201);
    }
}
