<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\TemplatedNotification;
use App\Models\MarketplaceOrder;
use App\Models\Order;
use App\Models\SellerListing;
use App\Models\Seller;
use App\Models\Dispute;
use App\Models\SellerStat;
use App\Services\LoggedEmailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class MarketplaceOrderController extends Controller
{
    private function frontendUrl(string $path = ''): string
    {
        $base = rtrim((string) (env('FRONTEND_URL', config('app.url'))), '/');
        $p = '/' . ltrim($path, '/');
        return $base . ($path !== '' ? $p : '');
    }

    private function resolveMarketplaceOrderForBuyer(Request $request, string $orderIdOrReference): Order
    {
        $needle = urldecode($orderIdOrReference);

        $order = Order::query()
            ->where('user_id', $request->user()->id)
            ->where('type', 'marketplace_gaming_account')
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

    public function whatsapp(Request $request, string $order)
    {
        $orderModel = $this->resolveMarketplaceOrderForBuyer($request, $order);

        if (!$orderModel->isPaymentSuccess()) {
            return response()->json([
                'status' => $orderModel->status,
                'whatsapp' => null,
            ]);
        }

        $orderMeta = $orderModel->meta ?? [];
        $listingId = $orderMeta['seller_listing_id'] ?? ($orderMeta['marketplace']['seller_listing_id'] ?? null);

        if (!$listingId) {
            return response()->json(['message' => 'Marketplace listing missing on order.'], 422);
        }

        $marketplaceOrder = MarketplaceOrder::query()->where('order_id', $orderModel->id)->with('listing.seller')->first();
        if (!$marketplaceOrder) {
            return response()->json(['message' => 'Marketplace order not ready yet.'], 409);
        }

        $listing = $marketplaceOrder->listing;
        $seller = $listing?->seller;

        if (!$listing || !$seller) {
            return response()->json(['message' => 'Listing/seller missing.'], 409);
        }

        $waNumberRaw = (string) ($seller->whatsapp_number ?? '');
        $waNumber = preg_replace('/[^0-9]/', '', $waNumberRaw);

        if (!$waNumber) {
            return response()->json(['message' => 'Seller WhatsApp number is invalid.'], 422);
        }

        if (!$marketplaceOrder->whatsapp_revealed_at) {
            $marketplaceOrder->whatsapp_revealed_at = now();
            $marketplaceOrder->save();
        }

        $title = (string) ($listing->title ?? 'Gaming Account');
        $price = (float) ($marketplaceOrder->price ?? $listing->price);

        $msg = "Bonjour, je viens d’acheter un compte sur le site PRIME Gaming: {$title}. Référence commande: {$orderModel->reference}. Montant: "
            . number_format($price, 0, ',', ' ') . " FCFA. Merci de me livrer dans les délais.";

        $url = 'https://wa.me/' . $waNumber . '?text=' . urlencode($msg);

        return response()->json([
            'status' => $orderModel->status,
            'deadline' => $marketplaceOrder->delivery_deadline_at?->toIso8601String(),
            'whatsapp' => [
                'number' => $waNumberRaw,
                'url' => $url,
                'message' => $msg,
            ],
        ]);
    }

    public function showMarketplace(Request $request, string $order)
    {
        $orderModel = $this->resolveMarketplaceOrderForBuyer($request, $order);

        $marketplaceOrder = MarketplaceOrder::query()
            ->where('order_id', $orderModel->id)
            ->with(['listing.game', 'listing.seller.stats'])
            ->first();

        if (!$marketplaceOrder) {
            return response()->json(['message' => 'Marketplace order not found.'], 404);
        }

        return response()->json([
            'ok' => true,
            'order' => [
                'id' => $orderModel->id,
                'reference' => $orderModel->reference,
                'status' => $orderModel->status,
                'delivered_at' => $orderModel->delivered_at?->toIso8601String(),
                'type' => $orderModel->type,
            ],
            'marketplaceOrder' => [
                'id' => $marketplaceOrder->id,
                'status' => $marketplaceOrder->status,
                'delivery_deadline_at' => $marketplaceOrder->delivery_deadline_at?->toIso8601String(),
                'delivered_at' => $marketplaceOrder->delivered_at?->toIso8601String(),
                'delivery_proof' => $marketplaceOrder->delivery_proof,
                'listing' => $marketplaceOrder->listing,
            ],
            'can_confirm_delivered' => $marketplaceOrder->status === 'delivered' && !$orderModel->delivered_at,
        ]);
    }

    public function confirmDelivered(Request $request, string $order)
    {
        $orderModel = $this->resolveMarketplaceOrderForBuyer($request, $order);

        if (!$orderModel->isPaymentSuccess()) {
            return response()->json(['message' => 'Order not paid.'], 422);
        }

        DB::transaction(function () use ($orderModel) {
            $freshOrder = Order::query()->lockForUpdate()->findOrFail($orderModel->id);

            $marketplaceOrder = MarketplaceOrder::query()
                ->where('order_id', $freshOrder->id)
                ->lockForUpdate()
                ->first();

            if (!$marketplaceOrder) {
                throw ValidationException::withMessages([
                    'order' => ['Marketplace order not found.'],
                ]);
            }

            if (in_array($marketplaceOrder->status, ['disputed', 'resolved_refund', 'resolved_release'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['Order cannot be confirmed in this status.'],
                ]);
            }

            if ($marketplaceOrder->status !== 'delivered') {
                throw ValidationException::withMessages([
                    'status' => ['Seller has not marked this order as delivered yet.'],
                ]);
            }

            if (!$freshOrder->delivered_at) {
                $freshOrder->delivered_at = now();
            }

            $meta = $freshOrder->meta;
            if (!is_array($meta)) {
                $meta = [];
            }
            $meta['fulfillment_status'] = 'fulfilled';
            $meta['marketplace_buyer_confirmed_delivered_at'] = now()->toIso8601String();
            $freshOrder->meta = $meta;

            $freshOrder->save();
        });

        // Email seller (best-effort)
        try {
            $mp = MarketplaceOrder::query()->with(['order', 'seller.user', 'listing', 'buyer'])->where('order_id', $orderModel->id)->first();
            $sellerUser = $mp?->seller?->user;
            if ($mp && $sellerUser && $sellerUser->email) {
                $subject = 'Livraison confirmée - Marketplace';
                $orderRef = (string) ($mp->order?->reference ?? $mp->order_id);
                $listingTitle = (string) ($mp->listing?->title ?? 'Compte Gaming');

                $mailable = new TemplatedNotification(
                    'marketplace_order_confirmed_seller',
                    $subject,
                    [
                        'marketplaceOrder' => $mp->toArray(),
                        'order' => $mp->order?->toArray() ?? [],
                        'user' => $sellerUser->toArray(),
                    ],
                    [
                        'title' => $subject,
                        'headline' => 'Acheteur: livraison confirmée',
                        'intro' => 'L’acheteur a confirmé la livraison de la commande.',
                        'details' => [
                            ['label' => 'Référence', 'value' => $orderRef],
                            ['label' => 'Annonce', 'value' => $listingTitle],
                        ],
                        'actionUrl' => $this->frontendUrl('/account/seller'),
                        'actionText' => 'Voir mes commandes',
                    ]
                );

                /** @var LoggedEmailService $logged */
                $logged = app(LoggedEmailService::class);
                $logged->queue($sellerUser->id, $sellerUser->email, 'marketplace_order_confirmed_seller', $subject, $mailable, [
                    'marketplace_order_id' => $mp->id,
                ]);
            }
        } catch (\Throwable $e) {
        }

        return response()->json(['ok' => true]);
    }

    public function openDispute(Request $request, string $order)
    {
        $orderModel = $this->resolveMarketplaceOrderForBuyer($request, $order);

        if (!$orderModel->isPaymentSuccess()) {
            return response()->json(['message' => 'Order not paid.'], 422);
        }

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
            'photos' => ['nullable', 'array', 'max:6'],
            'photos.*' => ['file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        $uploadsDisk = (string) (config('filesystems.public_uploads_disk') ?: 'public');

        $marketplaceOrder = MarketplaceOrder::query()->where('order_id', $orderModel->id)->with(['listing', 'seller'])->first();
        if (!$marketplaceOrder) {
            return response()->json(['message' => 'Marketplace order not found.'], 404);
        }

        if (in_array($marketplaceOrder->status, ['resolved_refund', 'resolved_release'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Order already resolved.'],
            ]);
        }

        $dispute = DB::transaction(function () use ($marketplaceOrder, $orderModel, $data, $request) {
            $existing = Dispute::query()->where('marketplace_order_id', $marketplaceOrder->id)->lockForUpdate()->first();
            if ($existing) {
                if (!$existing->reason && !empty($data['reason'])) {
                    $existing->reason = $data['reason'];
                }
                if ($request->hasFile('photos')) {
                    $paths = is_array($existing->evidence) ? $existing->evidence : [];
                    foreach ($request->file('photos', []) as $file) {
                        $paths[] = $file->store('disputes/' . $existing->id, $uploadsDisk);
                    }
                    $existing->evidence = array_values(array_unique(array_filter($paths)));
                }
                $existing->save();
                return $existing;
            }

            $dispute = Dispute::create([
                'marketplace_order_id' => $marketplaceOrder->id,
                'seller_listing_id' => $marketplaceOrder->seller_listing_id,
                'seller_id' => $marketplaceOrder->seller_id,
                'buyer_id' => $marketplaceOrder->buyer_id,
                'status' => 'open',
                'reason' => $data['reason'],
                'evidence' => [],
                'opened_at' => now(),
                'freeze_applied_at' => now(),
            ]);

            if ($request->hasFile('photos')) {
                $paths = [];
                foreach ($request->file('photos', []) as $file) {
                    $paths[] = $file->store('disputes/' . $dispute->id, $uploadsDisk);
                }
                $dispute->evidence = array_values(array_unique(array_filter($paths)));
                $dispute->save();
            }

            $marketplaceOrder->status = 'disputed';
            $marketplaceOrder->dispute_id = $dispute->id;
            $marketplaceOrder->save();

            // Freeze seller + disable listings
            $seller = Seller::query()->where('id', $marketplaceOrder->seller_id)->lockForUpdate()->first();
            if ($seller) {
                $seller->partner_wallet_frozen = true;
                $seller->partner_wallet_frozen_at = now();
                $seller->save();
            }

            SellerListing::query()
                ->where('seller_id', $marketplaceOrder->seller_id)
                ->whereNull('order_id')
                ->whereNull('sold_at')
                ->update([
                    'status' => 'suspended',
                    'status_reason' => 'Dispute opened',
                ]);

            $stats = SellerStat::query()->where('seller_id', $marketplaceOrder->seller_id)->lockForUpdate()->first();
            if ($stats) {
                $stats->disputed_sales = (int) $stats->disputed_sales + 1;
                $stats->save();
            }

            return $dispute;
        });

        $evidence = is_array($dispute->evidence) ? $dispute->evidence : [];
        $evidenceUrls = array_values(array_filter(array_map(function ($path) {
            if (!is_string($path) || !$path) {
                return null;
            }
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
        }, $evidence)));

        // Email buyer + seller (best-effort)
        try {
            $mp = MarketplaceOrder::query()
                ->with(['order', 'buyer', 'seller.user', 'listing'])
                ->where('order_id', $orderModel->id)
                ->first();

            if ($mp) {
                $orderRef = (string) ($mp->order?->reference ?? $mp->order_id);
                $listingTitle = (string) ($mp->listing?->title ?? 'Compte Gaming');

                /** @var LoggedEmailService $logged */
                $logged = app(LoggedEmailService::class);

                // Buyer confirmation
                $buyer = $mp->buyer;
                if ($buyer && $buyer->email) {
                    $subject = 'Litige ouvert - Marketplace';
                    $mailable = new TemplatedNotification(
                        'marketplace_dispute_opened_buyer',
                        $subject,
                        [
                            'dispute' => $dispute->toArray(),
                            'marketplaceOrder' => $mp->toArray(),
                            'order' => $mp->order?->toArray() ?? [],
                            'user' => $buyer->toArray(),
                        ],
                        [
                            'title' => $subject,
                            'headline' => 'Litige enregistré',
                            'intro' => 'Ton litige a bien été enregistré. Un agent va analyser ta demande.',
                            'details' => [
                                ['label' => 'Référence', 'value' => $orderRef],
                                ['label' => 'Annonce', 'value' => $listingTitle],
                                ['label' => 'Raison', 'value' => (string) ($dispute->reason ?? '—')],
                            ],
                            'actionUrl' => $this->frontendUrl('/account/litige'),
                            'actionText' => 'Suivre mon litige',
                        ]
                    );
                    $logged->queue($buyer->id, $buyer->email, 'marketplace_dispute_opened_buyer', $subject, $mailable, [
                        'dispute_id' => $dispute->id,
                        'marketplace_order_id' => $mp->id,
                    ]);
                }

                // Seller notification
                $sellerUser = $mp->seller?->user;
                if ($sellerUser && $sellerUser->email) {
                    $subject = 'Litige sur une commande - Marketplace';
                    $mailable = new TemplatedNotification(
                        'marketplace_dispute_opened_seller',
                        $subject,
                        [
                            'dispute' => $dispute->toArray(),
                            'marketplaceOrder' => $mp->toArray(),
                            'order' => $mp->order?->toArray() ?? [],
                            'user' => $sellerUser->toArray(),
                        ],
                        [
                            'title' => $subject,
                            'headline' => 'Litige ouvert',
                            'intro' => 'Un acheteur a ouvert un litige sur une de tes commandes. Ton wallet peut être gelé pendant l’analyse.',
                            'details' => [
                                ['label' => 'Référence', 'value' => $orderRef],
                                ['label' => 'Annonce', 'value' => $listingTitle],
                                ['label' => 'Raison', 'value' => (string) ($dispute->reason ?? '—')],
                            ],
                            'actionUrl' => $this->frontendUrl('/account/seller'),
                            'actionText' => 'Ouvrir mes commandes',
                        ]
                    );
                    $logged->queue($sellerUser->id, $sellerUser->email, 'marketplace_dispute_opened_seller', $subject, $mailable, [
                        'dispute_id' => $dispute->id,
                        'marketplace_order_id' => $mp->id,
                    ]);
                }
            }
        } catch (\Throwable $e) {
        }

        return response()->json([
            'ok' => true,
            'dispute' => $dispute,
            'evidence_urls' => $evidenceUrls,
        ], 201);
    }
}
