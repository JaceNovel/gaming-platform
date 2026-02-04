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

    public function openDispute(Request $request, string $order)
    {
        $orderModel = $this->resolveMarketplaceOrderForBuyer($request, $order);

        if (!$orderModel->isPaymentSuccess()) {
            return response()->json(['message' => 'Order not paid.'], 422);
        }

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
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

        $dispute = DB::transaction(function () use ($marketplaceOrder, $orderModel, $data) {
            $existing = Dispute::query()->where('marketplace_order_id', $marketplaceOrder->id)->lockForUpdate()->first();
            if ($existing) {
                return $existing;
            }

            $dispute = Dispute::create([
                'marketplace_order_id' => $marketplaceOrder->id,
                'seller_listing_id' => $marketplaceOrder->seller_listing_id,
                'seller_id' => $marketplaceOrder->seller_id,
                'buyer_id' => $marketplaceOrder->buyer_id,
                'status' => 'open',
                'reason' => $data['reason'],
                'opened_at' => now(),
                'freeze_applied_at' => now(),
            ]);

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
                ->where('status', '!=', 'sold')
                ->update([
                    'status' => 'disabled',
                    'status_reason' => 'Dispute opened',
                ]);

            $stats = SellerStat::query()->where('seller_id', $marketplaceOrder->seller_id)->lockForUpdate()->first();
            if ($stats) {
                $stats->disputed_sales = (int) $stats->disputed_sales + 1;
                $stats->save();
            }

            return $dispute;
        });

        return response()->json(['ok' => true, 'dispute' => $dispute], 201);
    }
}
