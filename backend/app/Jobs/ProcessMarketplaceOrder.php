<?php

namespace App\Jobs;

use App\Models\MarketplaceOrder;
use App\Models\Order;
use App\Models\PartnerWallet;
use App\Models\PartnerWalletTransaction;
use App\Models\SellerListing;
use App\Models\SellerStat;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProcessMarketplaceOrder implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public Order $order)
    {
    }

    public function handle(): void
    {
        if ((string) $this->order->type !== 'marketplace_gaming_account') {
            return;
        }

        $this->order->loadMissing('user');

        $orderMeta = $this->order->meta ?? [];
        if (!is_array($orderMeta)) {
            $orderMeta = [];
        }

        $listingId = $orderMeta['seller_listing_id'] ?? null;
        if (!$listingId) {
            Log::warning('marketplace:missing-listing-id', ['order_id' => $this->order->id]);
            return;
        }

        DB::transaction(function () use ($listingId) {
            $listing = SellerListing::query()->lockForUpdate()->findOrFail((int) $listingId);
            $listing->loadMissing('seller');

            $seller = $listing->seller;
            if (!$seller || $seller->status !== 'approved' || $seller->partner_wallet_frozen) {
                    // Seller no longer eligible: keep listing off the marketplace.
                    $listing->status = 'suspended';
                $listing->status_reason = 'Seller not eligible.';
                $listing->reserved_order_id = null;
                $listing->reserved_until = null;
                $listing->save();
                return;
            }

            $commission = (float) (
                $orderMeta['commission_amount']
                ?? ($orderMeta['marketplace']['commission_amount'] ?? null)
                ?? 400
            );
            $price = (float) ($this->order->total_price ?? $listing->price);
            $earnings = max(0.0, $price - $commission);

            $existingMarketplaceOrder = MarketplaceOrder::query()->where('order_id', $this->order->id)->lockForUpdate()->first();
            if ($existingMarketplaceOrder) {
                return;
            }

            if ($listing->status === 'sold' || $listing->order_id) {
                // Listing sold by another order.
                return;
            }

            $creditRef = 'marketplace_credit_pending_order_' . $this->order->id;
            $existingCredit = PartnerWalletTransaction::query()->where('reference', $creditRef)->lockForUpdate()->first();
            if ($existingCredit) {
                return;
            }

            $marketplaceOrder = MarketplaceOrder::create([
                'order_id' => $this->order->id,
                'seller_listing_id' => $listing->id,
                'seller_id' => $seller->id,
                'buyer_id' => $this->order->user_id,
                'status' => 'paid',
                'price' => $price,
                'commission_amount' => $commission,
                'seller_earnings' => $earnings,
                'delivery_deadline_at' => now()->addHours((int) ($listing->delivery_window_hours ?? 24)),
            ]);

            $wallet = PartnerWallet::query()->firstOrCreate(
                ['seller_id' => $seller->id],
                [
                    'currency' => 'FCFA',
                    'available_balance' => 0,
                    'pending_balance' => 0,
                    'reserved_withdraw_balance' => 0,
                    'status' => 'active',
                ]
            );

            // Credit pending earnings
            $wallet = PartnerWallet::query()->where('id', $wallet->id)->lockForUpdate()->first();

            $wallet->pending_balance = (float) $wallet->pending_balance + $earnings;
            $wallet->save();

            PartnerWalletTransaction::create([
                'partner_wallet_id' => $wallet->id,
                'type' => 'credit_pending',
                'amount' => $earnings,
                'reference' => $creditRef,
                'meta' => [
                    'order_id' => $this->order->id,
                    'marketplace_order_id' => $marketplaceOrder->id,
                    'seller_listing_id' => $listing->id,
                    'commission' => $commission,
                    'price' => $price,
                ],
                'status' => 'success',
            ]);

            $stats = SellerStat::query()->firstOrCreate(['seller_id' => $seller->id]);
            $stats = SellerStat::query()->where('seller_id', $seller->id)->lockForUpdate()->first();
            if ($stats) {
                $stats->total_sales = (int) $stats->total_sales + 1;
                $stats->last_sale_at = now();
                $stats->save();
            }

            // Finalize listing sale (after wallet credit)
                // Keep status as approved for audit/history; sold_at/order_id removes it from public.
                $listing->status = 'approved';
            $listing->order_id = $this->order->id;
            $listing->reserved_order_id = null;
            $listing->reserved_until = null;
            $listing->sold_at = now();
            $listing->save();

            $orderMeta = $this->order->meta ?? [];
            if (!is_array($orderMeta)) {
                $orderMeta = [];
            }
            $orderMeta['marketplace'] = [
                'seller_listing_id' => $listing->id,
                'marketplace_order_id' => $marketplaceOrder->id,
                'commission_amount' => $commission,
                'seller_earnings' => $earnings,
                'price' => $price,
            ];
            $orderMeta['delivery_state'] = 'marketplace_paid';
            $this->order->meta = $orderMeta;
            $this->order->save();
        });
    }
}
