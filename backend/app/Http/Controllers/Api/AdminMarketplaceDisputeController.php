<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\TemplatedNotification;
use App\Models\Dispute;
use App\Models\MarketplaceOrder;
use App\Models\PartnerWallet;
use App\Models\PartnerWalletTransaction;
use App\Models\Refund;
use App\Models\Seller;
use App\Services\AdminAuditLogger;
use App\Services\LoggedEmailService;
use App\Services\WalletService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AdminMarketplaceDisputeController extends Controller
{
    private function frontendUrl(string $path = ''): string
    {
        $base = rtrim((string) (env('FRONTEND_URL', config('app.url'))), '/');
        $p = '/' . ltrim($path, '/');
        return $base . ($path !== '' ? $p : '');
    }

    public function index(Request $request)
    {
        $q = Dispute::query()->with(['buyer', 'seller.user', 'listing', 'marketplaceOrder.order']);

        if ($request->filled('status')) {
            $q->where('status', $request->string('status')->toString());
        }

        $disputes = $q->orderByDesc('created_at')->paginate(30);

        $disputes->getCollection()->transform(function (Dispute $d) {
            $evidence = is_array($d->evidence) ? $d->evidence : [];
            $d->setAttribute('evidence_urls', array_values(array_filter(array_map(function ($path) {
                if (!is_string($path) || !$path) return null;
                try {
                    $raw = trim((string) $path);
                    if ($raw === '') return null;
                    if (preg_match('/^https?:\/\//i', $raw)) return $raw;
                    if (str_starts_with($raw, '/api/storage/')) return $raw;
                    if (str_starts_with($raw, '/storage/')) return '/api' . $raw;
                    return '/api/storage/' . ltrim($raw, '/');
                } catch (\Throwable $e) {
                    return null;
                }
            }, $evidence))));
            return $d;
        });

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

        // Email buyer + seller (best-effort)
        try {
            $fresh = Dispute::query()->with(['buyer', 'seller.user', 'listing', 'marketplaceOrder.order'])->find($dispute->id);
            $mp = $fresh?->marketplaceOrder;
            if ($fresh && $mp) {
                $orderRef = (string) ($mp->order?->reference ?? $mp->order_id);
                $listingTitle = (string) ($fresh->listing?->title ?? $mp->listing?->title ?? 'Compte Gaming');
                $resolution = (string) ($fresh->resolution ?? $data['resolution']);

                /** @var LoggedEmailService $logged */
                $logged = app(LoggedEmailService::class);

                $buyer = $fresh->buyer;
                if ($buyer && $buyer->email) {
                    $subject = 'Décision litige - Marketplace';
                    $headline = $resolution === 'refund_buyer_wallet' ? 'Remboursement validé' : 'Litige résolu';
                    $intro = $resolution === 'refund_buyer_wallet'
                        ? 'Ton litige a été validé: un remboursement a été initié sur ton DB Wallet.'
                        : 'Ton litige a été résolu. Merci de vérifier ton compte.';

                    $mailable = new TemplatedNotification(
                        'marketplace_dispute_resolved_buyer',
                        $subject,
                        [
                            'dispute' => $fresh->toArray(),
                            'marketplaceOrder' => $mp->toArray(),
                            'order' => $mp->order?->toArray() ?? [],
                            'user' => $buyer->toArray(),
                        ],
                        [
                            'title' => $subject,
                            'headline' => $headline,
                            'intro' => $intro,
                            'details' => [
                                ['label' => 'Référence', 'value' => $orderRef],
                                ['label' => 'Annonce', 'value' => $listingTitle],
                                ['label' => 'Décision', 'value' => $resolution],
                                ['label' => 'Note', 'value' => (string) ($fresh->resolution_note ?? $data['note'] ?? '—')],
                            ],
                            'actionUrl' => $this->frontendUrl('/account/litige'),
                            'actionText' => 'Voir le litige',
                        ]
                    );
                    $logged->queue($buyer->id, $buyer->email, 'marketplace_dispute_resolved_buyer', $subject, $mailable, [
                        'dispute_id' => $fresh->id,
                        'marketplace_order_id' => $mp->id,
                    ]);
                }

                $sellerUser = $fresh->seller?->user;
                if ($sellerUser && $sellerUser->email) {
                    $subject = 'Décision litige - Marketplace';
                    $headline = $resolution === 'release_to_seller' ? 'Paiement libéré' : 'Commande remboursée';
                    $intro = $resolution === 'release_to_seller'
                        ? 'Le litige a été résolu en ta faveur: le paiement est libéré.'
                        : 'Le litige a été résolu: la commande est remboursée à l’acheteur.';

                    $mailable = new TemplatedNotification(
                        'marketplace_dispute_resolved_seller',
                        $subject,
                        [
                            'dispute' => $fresh->toArray(),
                            'marketplaceOrder' => $mp->toArray(),
                            'order' => $mp->order?->toArray() ?? [],
                            'user' => $sellerUser->toArray(),
                        ],
                        [
                            'title' => $subject,
                            'headline' => $headline,
                            'intro' => $intro,
                            'details' => [
                                ['label' => 'Référence', 'value' => $orderRef],
                                ['label' => 'Annonce', 'value' => $listingTitle],
                                ['label' => 'Décision', 'value' => $resolution],
                                ['label' => 'Note', 'value' => (string) ($fresh->resolution_note ?? $data['note'] ?? '—')],
                            ],
                            'actionUrl' => $this->frontendUrl('/account/seller'),
                            'actionText' => 'Voir mes commandes',
                        ]
                    );
                    $logged->queue($sellerUser->id, $sellerUser->email, 'marketplace_dispute_resolved_seller', $subject, $mailable, [
                        'dispute_id' => $fresh->id,
                        'marketplace_order_id' => $mp->id,
                    ]);
                }
            }
        } catch (\Throwable $e) {
        }

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
