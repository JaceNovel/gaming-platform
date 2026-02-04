<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Dispute;
use App\Models\MarketplaceOrder;
use App\Models\PartnerWallet;
use App\Models\PartnerWalletTransaction;
use App\Models\Refund;
use App\Models\Seller;
use App\Services\AdminAuditLogger;
use App\Services\WalletService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminMarketplaceDisputeController extends Controller
{
    public function index(Request $request)
    {
        $q = Dispute::query()->with(['buyer', 'seller.user', 'listing', 'marketplaceOrder.order']);

        if ($request->filled('status')) {
            $q->where('status', $request->string('status')->toString());
        }

        $disputes = $q->orderByDesc('created_at')->paginate(30);

        return response()->json(['data' => $disputes]);
    }

    public function resolve(Request $request, Dispute $dispute, WalletService $walletService)
    {
        $admin = $request->user();

        $data = $request->validate([
            'resolution' => ['required', 'in:refund_buyer_wallet,release_to_seller'],
            'note' => ['nullable', 'string', 'max:2000'],
            'sellerWallet' => ['nullable', 'in:unfreeze,keep_frozen'],
        ]);

        if ($dispute->status === 'resolved') {
            throw ValidationException::withMessages([
                'status' => ['Dispute already resolved.'],
            ]);
        }

        if (!$dispute->marketplace_order_id) {
            return response()->json(['message' => 'Dispute is not linked to a marketplace order.'], 422);
        }

        DB::transaction(function () use ($dispute, $data, $admin, $walletService) {
            $disputeRow = Dispute::query()->lockForUpdate()->findOrFail($dispute->id);

            $mpOrder = MarketplaceOrder::query()->with(['order', 'buyer', 'seller', 'listing'])
                ->lockForUpdate()
                ->findOrFail((int) $disputeRow->marketplace_order_id);

            if ($data['resolution'] === 'refund_buyer_wallet') {
                $amount = (float) $mpOrder->price;
                $reference = 'REF-MP-' . $mpOrder->id;

                $walletService->credit($mpOrder->buyer, $reference, $amount, [
                    'type' => 'marketplace_refund',
                    'reason' => 'Litige Marketplace: remboursement',
                    'marketplace_order_id' => $mpOrder->id,
                    'order_id' => $mpOrder->order_id,
                    'admin_id' => $admin->id,
                ]);

                Refund::firstOrCreate(
                    ['reference' => $reference],
                    [
                        'order_id' => $mpOrder->order_id,
                        'user_id' => $mpOrder->buyer_id,
                        'amount' => $amount,
                        'reason' => 'Marketplace dispute refund',
                        'status' => 'completed',
                    ]
                );

                // Reverse pending credit (best-effort)
                $wallet = PartnerWallet::query()->where('seller_id', $mpOrder->seller_id)->lockForUpdate()->first();
                if ($wallet) {
                    $ref = 'marketplace_refund_reverse_' . $mpOrder->id;
                    $existing = PartnerWalletTransaction::query()->where('reference', $ref)->lockForUpdate()->first();
                    if (!$existing) {
                        $wallet->pending_balance = max(0.0, (float) $wallet->pending_balance - (float) $mpOrder->seller_earnings);
                        $wallet->save();

                        PartnerWalletTransaction::create([
                            'partner_wallet_id' => $wallet->id,
                            'type' => 'adjustment',
                            'amount' => -1 * (float) $mpOrder->seller_earnings,
                            'reference' => $ref,
                            'meta' => [
                                'marketplace_order_id' => $mpOrder->id,
                                'dispute_id' => $disputeRow->id,
                                'resolution' => 'refund_buyer_wallet',
                            ],
                            'status' => 'success',
                        ]);
                    }
                }

                $mpOrder->status = 'resolved_refund';
            } else {
                // Release pending to available
                $wallet = PartnerWallet::query()->where('seller_id', $mpOrder->seller_id)->lockForUpdate()->firstOrFail();

                $amount = (float) $mpOrder->seller_earnings;
                $ref = 'marketplace_release_' . $mpOrder->id;
                $existing = PartnerWalletTransaction::query()->where('reference', $ref)->lockForUpdate()->first();
                if (!$existing) {
                    $wallet->pending_balance = max(0.0, (float) $wallet->pending_balance - $amount);
                    $wallet->available_balance = (float) $wallet->available_balance + $amount;
                    $wallet->save();

                    PartnerWalletTransaction::create([
                        'partner_wallet_id' => $wallet->id,
                        'type' => 'release_to_available',
                        'amount' => $amount,
                        'reference' => $ref,
                        'meta' => [
                            'marketplace_order_id' => $mpOrder->id,
                            'dispute_id' => $disputeRow->id,
                            'resolution' => 'release_to_seller',
                        ],
                        'status' => 'success',
                    ]);
                }

                $mpOrder->status = 'resolved_release';
            }

            $mpOrder->save();

            $walletAction = $data['sellerWallet'] ?? 'unfreeze';
            if ($walletAction === 'unfreeze') {
                $seller = Seller::query()->where('id', $mpOrder->seller_id)->lockForUpdate()->first();
                if ($seller && $seller->partner_wallet_frozen) {
                    $seller->partner_wallet_frozen = false;
                    $seller->partner_wallet_frozen_at = null;
                    $seller->save();
                }
            }

            // Mark dispute resolved
            $disputeRow->status = 'resolved';
            $disputeRow->resolved_by_admin_id = $admin->id;
            $disputeRow->resolution = $data['resolution'];
            $disputeRow->resolution_note = $data['note'] ?? null;
            $disputeRow->resolved_at = now();
            $disputeRow->save();
        });

        try {
            /** @var AdminAuditLogger $audit */
            $audit = app(AdminAuditLogger::class);
            $audit->log($admin, 'marketplace.dispute.resolve', [
                'dispute_id' => $dispute->id,
                'resolution' => $data['resolution'],
            ], 'marketplace', $request);
        } catch (\Throwable $e) {
        }

        return response()->json(['ok' => true]);
    }
}
