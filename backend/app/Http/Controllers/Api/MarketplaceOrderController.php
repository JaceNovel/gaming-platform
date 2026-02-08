<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MarketplaceOrder;
use App\Models\Order;
use App\Models\SellerListing;
use App\Models\Seller;
use App\Models\Dispute;
use App\Models\SellerStat;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class MarketplaceOrderController extends Controller
{
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

        $msg = "Bonjour, je viens d’acheter: {$title}. Référence commande: {$orderModel->reference}. Montant: "
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
                        $paths[] = $file->store('disputes/' . $existing->id, 'public');
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
                    $paths[] = $file->store('disputes/' . $dispute->id, 'public');
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
                return Storage::disk('public')->url($path);
            } catch (\Throwable $e) {
                return null;
            }
        }, $evidence)));

        return response()->json([
            'ok' => true,
            'dispute' => $dispute,
            'evidence_urls' => $evidenceUrls,
        ], 201);
    }
}
