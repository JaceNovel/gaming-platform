<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PartnerWallet;
use App\Models\PartnerWithdrawRequest;
use App\Models\Seller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PartnerWalletController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user();
        $seller = Seller::query()->where('user_id', $user->id)->first();

        if (!$seller) {
            return response()->json(['partnerWallet' => null, 'withdrawRequests' => []]);
        }

        $wallet = PartnerWallet::query()->where('seller_id', $seller->id)->first();

        $withdrawRequests = PartnerWithdrawRequest::query()
            ->where('seller_id', $seller->id)
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

        return response()->json([
            'sellerStatus' => $seller->status,
            'partnerWalletFrozen' => (bool) $seller->partner_wallet_frozen,
            'partnerWallet' => $wallet,
            'withdrawRequests' => $withdrawRequests,
        ]);
    }

    public function requestWithdraw(Request $request)
    {
        $user = $request->user();
        $seller = Seller::query()->where('user_id', $user->id)->firstOrFail();

        if ($seller->status !== 'approved') {
            throw ValidationException::withMessages([
                'seller' => ['Seller is not approved.'],
            ]);
        }

        if ($seller->partner_wallet_frozen) {
            return response()->json(['message' => 'Partner wallet is frozen.'], 403);
        }

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
            'payoutDetails' => ['nullable', 'array'],
        ]);

        /** @var PartnerWithdrawRequest $withdraw */
        $withdraw = DB::transaction(function () use ($seller, $data) {
            $wallet = PartnerWallet::query()
                ->where('seller_id', $seller->id)
                ->lockForUpdate()
                ->first();

            if (!$wallet) {
                throw ValidationException::withMessages([
                    'partnerWallet' => ['Partner wallet not found.'],
                ]);
            }

            if ($wallet->status === 'frozen') {
                throw ValidationException::withMessages([
                    'partnerWallet' => ['Partner wallet is frozen.'],
                ]);
            }

            $amount = (float) $data['amount'];

            if ($amount > (float) $wallet->available_balance) {
                throw ValidationException::withMessages([
                    'amount' => ['Insufficient available balance.'],
                ]);
            }

            $wallet->available_balance = (float) $wallet->available_balance - $amount;
            $wallet->reserved_withdraw_balance = (float) $wallet->reserved_withdraw_balance + $amount;
            $wallet->save();

            return PartnerWithdrawRequest::create([
                'partner_wallet_id' => $wallet->id,
                'seller_id' => $seller->id,
                'amount' => $amount,
                'status' => 'requested',
                'payout_details' => $data['payoutDetails'] ?? null,
            ]);
        });

        return response()->json(['ok' => true, 'withdrawRequest' => $withdraw], 201);
    }
}
