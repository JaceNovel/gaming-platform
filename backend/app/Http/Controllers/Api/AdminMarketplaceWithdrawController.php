<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendEmailJob;
use App\Mail\PartnerWithdrawPaid;
use App\Models\EmailLog;
use App\Models\PartnerWallet;
use App\Models\PartnerWalletTransaction;
use App\Models\PartnerWithdrawRequest;
use App\Services\AdminAuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminMarketplaceWithdrawController extends Controller
{
    public function index(Request $request)
    {
        $q = PartnerWithdrawRequest::query()->with(['seller.user', 'partnerWallet']);

        if ($request->filled('status')) {
            $q->where('status', $request->string('status')->toString());
        }

        $withdraws = $q->orderByDesc('created_at')->paginate(30);

        return response()->json(['data' => $withdraws]);
    }

    public function markPaid(Request $request, PartnerWithdrawRequest $partnerWithdrawRequest)
    {
        $admin = $request->user();

        if ($partnerWithdrawRequest->status !== 'requested') {
            throw ValidationException::withMessages([
                'status' => ['Withdraw request is not in requested status.'],
            ]);
        }

        $data = $request->validate([
            'adminNote' => ['nullable', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($partnerWithdrawRequest, $admin, $data) {
            $wallet = PartnerWallet::query()->where('id', $partnerWithdrawRequest->partner_wallet_id)->lockForUpdate()->firstOrFail();

            $amount = (float) $partnerWithdrawRequest->amount;

            if ($amount > (float) $wallet->reserved_withdraw_balance) {
                throw ValidationException::withMessages([
                    'amount' => ['Reserved balance is insufficient.'],
                ]);
            }

            $wallet->reserved_withdraw_balance = (float) $wallet->reserved_withdraw_balance - $amount;
            $wallet->save();

            $partnerWithdrawRequest->status = 'paid';
            $partnerWithdrawRequest->processed_by_admin_id = $admin->id;
            $partnerWithdrawRequest->processed_at = now();
            $partnerWithdrawRequest->admin_note = $data['adminNote'] ?? null;
            $partnerWithdrawRequest->save();

            PartnerWalletTransaction::create([
                'partner_wallet_id' => $wallet->id,
                'type' => 'debit_withdraw',
                'amount' => $amount,
                'reference' => 'partner_withdraw_paid_' . $partnerWithdrawRequest->id,
                'meta' => [
                    'withdraw_request_id' => $partnerWithdrawRequest->id,
                    'seller_id' => $partnerWithdrawRequest->seller_id,
                    'admin_id' => $admin->id,
                ],
                'status' => 'success',
            ]);
        });

        $partnerWithdrawRequest->load(['seller.user', 'partnerWallet']);

        // Email seller (best-effort)
        try {
            $user = $partnerWithdrawRequest->seller?->user;
            if ($user && $user->email) {
                $subject = 'Retrait payé - DB Partner';
                $emailLog = EmailLog::create([
                    'user_id' => $user->id,
                    'to' => $user->email,
                    'type' => 'partner_withdraw_paid',
                    'subject' => $subject,
                    'status' => 'pending',
                ]);

                $mailable = new PartnerWithdrawPaid($partnerWithdrawRequest);
                dispatch(new SendEmailJob($mailable, $emailLog));
            }
        } catch (\Throwable $e) {
        }

        try {
            /** @var AdminAuditLogger $audit */
            $audit = app(AdminAuditLogger::class);
            $audit->log($admin, 'marketplace.withdraw.mark_paid', [
                'withdraw_request_id' => $partnerWithdrawRequest->id,
                'seller_id' => $partnerWithdrawRequest->seller_id,
                'amount' => (float) $partnerWithdrawRequest->amount,
            ], 'marketplace', $request);
        } catch (\Throwable $e) {
        }

        return response()->json(['ok' => true]);
    }

    public function reject(Request $request, PartnerWithdrawRequest $partnerWithdrawRequest)
    {
        $admin = $request->user();

        if ($partnerWithdrawRequest->status !== 'requested') {
            throw ValidationException::withMessages([
                'status' => ['Withdraw request is not in requested status.'],
            ]);
        }

        $data = $request->validate([
            'adminNote' => ['required', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($partnerWithdrawRequest, $admin, $data) {
            $wallet = PartnerWallet::query()->where('id', $partnerWithdrawRequest->partner_wallet_id)->lockForUpdate()->firstOrFail();

            $amount = (float) $partnerWithdrawRequest->amount;

            if ($amount > (float) $wallet->reserved_withdraw_balance) {
                throw ValidationException::withMessages([
                    'amount' => ['Reserved balance is insufficient.'],
                ]);
            }

            $wallet->reserved_withdraw_balance = (float) $wallet->reserved_withdraw_balance - $amount;
            $wallet->available_balance = (float) $wallet->available_balance + $amount;
            $wallet->save();

            $partnerWithdrawRequest->status = 'rejected';
            $partnerWithdrawRequest->processed_by_admin_id = $admin->id;
            $partnerWithdrawRequest->processed_at = now();
            $partnerWithdrawRequest->admin_note = $data['adminNote'];
            $partnerWithdrawRequest->save();
        });

        try {
            /** @var AdminAuditLogger $audit */
            $audit = app(AdminAuditLogger::class);
            $audit->log($admin, 'marketplace.withdraw.reject', [
                'withdraw_request_id' => $partnerWithdrawRequest->id,
                'seller_id' => $partnerWithdrawRequest->seller_id,
                'amount' => (float) $partnerWithdrawRequest->amount,
                'note' => $data['adminNote'],
            ], 'marketplace', $request);
        } catch (\Throwable $e) {
        }

        return response()->json(['ok' => true]);
    }
}
