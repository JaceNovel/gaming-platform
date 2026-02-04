<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MarketplaceOrder;
use App\Models\PartnerWallet;
use App\Models\PartnerWalletTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminMarketplaceOrderController extends Controller
{
    public function index(Request $request)
    {
        $q = MarketplaceOrder::query()->with(['order', 'buyer', 'seller.user', 'listing', 'dispute']);

        if ($request->filled('status')) {
            $q->where('status', $request->string('status')->toString());
        }

        if ($request->filled('sellerId')) {
            $q->where('seller_id', $request->integer('sellerId'));
        }

        if ($request->filled('buyerId')) {
            $q->where('buyer_id', $request->integer('buyerId'));
        }

        $orders = $q->orderByDesc('created_at')->paginate(30);

        return response()->json(['data' => $orders]);
    }

    public function release(Request $request, MarketplaceOrder $marketplaceOrder)
    {
        $data = $request->validate([
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($marketplaceOrder, $data) {
            $mpOrder = MarketplaceOrder::query()->with('order')->lockForUpdate()->findOrFail($marketplaceOrder->id);

            if (in_array($mpOrder->status, ['resolved_refund', 'resolved_release'], true)) {
                return;
            }

            if ($mpOrder->status === 'disputed') {
                throw ValidationException::withMessages([
                    'status' => ['Order is disputed and cannot be released here.'],
                ]);
            }

            if (!$mpOrder->order || !$mpOrder->order->isPaymentSuccess()) {
                throw ValidationException::withMessages([
                    'payment' => ['Order is not paid.'],
                ]);
            }

            $wallet = PartnerWallet::query()->where('seller_id', $mpOrder->seller_id)->lockForUpdate()->firstOrFail();

            $amount = (float) $mpOrder->seller_earnings;
            $reference = 'marketplace_release_' . $mpOrder->id;

            $existingTx = PartnerWalletTransaction::query()->where('reference', $reference)->lockForUpdate()->first();
            if (!$existingTx) {
                if ((float) $wallet->pending_balance + 0.0001 < $amount) {
                    throw ValidationException::withMessages([
                        'wallet' => ['Insufficient pending balance to release.'],
                    ]);
                }

                $wallet->pending_balance = max(0.0, (float) $wallet->pending_balance - $amount);
                $wallet->available_balance = (float) $wallet->available_balance + $amount;
                $wallet->save();

                PartnerWalletTransaction::create([
                    'partner_wallet_id' => $wallet->id,
                    'type' => 'release_to_available',
                    'amount' => $amount,
                    'reference' => $reference,
                    'meta' => [
                        'marketplace_order_id' => $mpOrder->id,
                        'order_id' => $mpOrder->order_id,
                        'note' => $data['note'] ?? null,
                        'mode' => 'manual_admin',
                    ],
                    'status' => 'success',
                ]);
            }

            $mpOrder->status = 'resolved_release';
            $mpOrder->save();
        });

        return response()->json(['ok' => true]);
    }
}
