<?php

namespace App\Jobs;

use App\Mail\TemplatedNotification;
use App\Models\MarketplaceOrder;
use App\Models\Order;
use App\Models\PartnerWallet;
use App\Models\PartnerWalletTransaction;
use App\Models\SellerListing;
use App\Models\SellerStat;
use App\Services\LoggedEmailService;
use App\Services\SellerSalesLimitService;
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

        $createdMarketplaceOrderId = null;

        DB::transaction(function () use ($listingId, $orderMeta, &$createdMarketplaceOrderId) {
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
                    ?? 0
                );
            $price = (float) ($this->order->total_price ?? $listing->price);
                // Commission is disabled by default; protect against unexpected commission values.
                if ($commission < 0 || $commission > $price) {
                    $commission = 0;
                }

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

            $createdMarketplaceOrderId = $marketplaceOrder->id;

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

            $salesLimitService = app(SellerSalesLimitService::class);
            $seller->loadMissing('user');

            if (!$salesLimitService->isVipSeller($seller)) {
                $monthlySales = $salesLimitService->monthlySalesForSeller($seller);
                if ($monthlySales >= SellerSalesLimitService::NON_VIP_MONTHLY_LIMIT) {
                    $seller->partner_wallet_frozen = true;
                    $seller->partner_wallet_frozen_at = now();
                    $seller->status_reason = $salesLimitService->limitMessage();
                    $seller->save();

                    SellerListing::query()
                        ->where('seller_id', $seller->id)
                        ->whereNull('order_id')
                        ->whereNull('sold_at')
                        ->whereIn('status', ['approved', 'pending_review', 'pending_review_update'])
                        ->update([
                            'status' => 'suspended',
                            'status_reason' => $salesLimitService->limitMessage(),
                        ]);

                    PartnerWallet::query()->where('seller_id', $seller->id)->update([
                        'status' => 'frozen',
                        'status_reason' => $salesLimitService->limitMessage(),
                        'frozen_at' => now(),
                    ]);
                }
            }
        });

        // Email buyer + seller (best-effort, after transaction)
        if ($createdMarketplaceOrderId) {
            try {
                $mp = MarketplaceOrder::query()
                    ->with(['order.user', 'buyer', 'seller.user', 'listing.game'])
                    ->find($createdMarketplaceOrderId);

                if ($mp && $mp->order && $mp->buyer && $mp->seller) {
                    $front = rtrim((string) (env('FRONTEND_URL', config('app.url'))), '/');
                    $orderRef = (string) ($mp->order->reference ?? $mp->order_id);
                    $listingTitle = (string) ($mp->listing?->title ?? 'Compte Gaming');
                    $price = (float) ($mp->price ?? 0);

                    /** @var LoggedEmailService $logged */
                    $logged = app(LoggedEmailService::class);

                    // Buyer
                    $buyer = $mp->buyer;
                    if ($buyer->email) {
                        $sellerUser = $mp->seller?->user;
                        $sellerPhoneRaw = (string) ($sellerUser?->phone ?? '');
                        $sellerPhoneDigits = preg_replace('/\D+/', '', $sellerPhoneRaw) ?? '';
                        $whatsAppUrl = $sellerPhoneDigits !== ''
                            ? 'https://wa.me/' . $sellerPhoneDigits
                            : null;

                        $gameName = strtolower((string) ($mp->listing?->game?->name ?? ''));
                        $isFreeFire = $gameName !== '' && str_contains($gameName, 'free fire');
                        $freeFireGuideUrl = $isFreeFire
                            ? ($front . '/images/' . rawurlencode('🔐 Procédure de liaison du compte Free Fire.pdf'))
                            : null;
                        $chatUrl = $isFreeFire
                            ? ($front . '/chat?intent=free_fire_security&order_ref=' . rawurlencode($orderRef))
                            : ($front . '/chat');

                        $subject = 'Achat confirmé - Marketplace';
                        $mailable = new TemplatedNotification(
                            'marketplace_order_paid_buyer',
                            $subject,
                            [
                                'marketplaceOrder' => $mp->toArray(),
                                'order' => $mp->order->toArray(),
                                'user' => $buyer->toArray(),
                                'seller' => $sellerUser?->toArray() ?? [],
                                'seller_whatsapp_url' => $whatsAppUrl,
                                'free_fire_guide_url' => $freeFireGuideUrl,
                                'chat_url' => $chatUrl,
                            ],
                            [
                                'title' => $subject,
                                'headline' => 'Paiement confirmé',
                                'intro' => 'Ton achat marketplace est confirmé. Contacte le vendeur pour finaliser la livraison.',
                                'details' => [
                                    ['label' => 'Référence', 'value' => $orderRef],
                                    ['label' => 'Annonce', 'value' => $listingTitle],
                                    ['label' => 'Montant', 'value' => number_format($price, 0, ',', ' ') . ' FCFA'],
                                    ['label' => 'Délai', 'value' => $mp->delivery_deadline_at ? $mp->delivery_deadline_at->toDateTimeString() : '—'],
                                    ['label' => 'WhatsApp vendeur', 'value' => $whatsAppUrl ? $whatsAppUrl : ($sellerPhoneRaw !== '' ? $sellerPhoneRaw : '—')],
                                    ...($freeFireGuideUrl ? [['label' => 'Guide sécurisation Free Fire (PDF)', 'value' => $freeFireGuideUrl]] : []),
                                    ...($isFreeFire ? [['label' => 'Assistance (Chat Direct)', 'value' => $chatUrl]] : []),
                                ],
                                'outro' => $isFreeFire
                                    ? "Sécurise ton compte dès réception : change email et mot de passe, active la double authentification (2FA), et ne partage jamais les identifiants. Besoin d’aide ? Contacte-nous via le Chat en Direct pour prendre un rendez-vous (1000 FCFA / heure)."
                                    : "Sécurise ton compte dès réception : change email et mot de passe, active la double authentification (2FA), et ne partage jamais les identifiants. Si tu as un souci, ouvre le chat directement sur PRIME Gaming.",
                                'actionUrl' => $front . '/account',
                                'actionText' => 'Ouvrir mon compte',
                            ]
                        );
                        $logged->queue($buyer->id, $buyer->email, 'marketplace_order_paid_buyer', $subject, $mailable, [
                            'marketplace_order_id' => $mp->id,
                            'order_id' => $mp->order_id,
                        ]);
                    }

                    // Seller
                    $sellerUser = $mp->seller?->user;
                    if ($sellerUser && $sellerUser->email) {
                        $subject = 'Nouvelle commande - Marketplace';
                        $mailable = new TemplatedNotification(
                            'marketplace_order_paid_seller',
                            $subject,
                            [
                                'marketplaceOrder' => $mp->toArray(),
                                'order' => $mp->order->toArray(),
                                'user' => $sellerUser->toArray(),
                            ],
                            [
                                'title' => $subject,
                                'headline' => 'Nouvelle commande payée',
                                'intro' => 'Un acheteur vient de payer une commande sur ton annonce. Merci de livrer dans les délais et d’ajouter une preuve.',
                                'details' => [
                                    ['label' => 'Référence', 'value' => $orderRef],
                                    ['label' => 'Annonce', 'value' => $listingTitle],
                                    ['label' => 'Montant', 'value' => number_format($price, 0, ',', ' ') . ' FCFA'],
                                    ['label' => 'Deadline', 'value' => $mp->delivery_deadline_at ? $mp->delivery_deadline_at->toDateTimeString() : '—'],
                                ],
                                'actionUrl' => $front . '/account/seller',
                                'actionText' => 'Ouvrir mes commandes',
                            ]
                        );
                        $logged->queue($sellerUser->id, $sellerUser->email, 'marketplace_order_paid_seller', $subject, $mailable, [
                            'marketplace_order_id' => $mp->id,
                            'order_id' => $mp->order_id,
                        ]);
                    }
                }
            } catch (\Throwable $e) {
            }
        }
    }
}
