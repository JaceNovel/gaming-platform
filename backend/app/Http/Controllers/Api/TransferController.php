<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\TransferInitRequest;
use App\Jobs\ProcessPayout;
use App\Models\AdminLog;
use App\Models\Payout;
use App\Models\PayoutEvent;
use App\Models\WalletTransaction;
use App\Services\CinetPayTransferService;
use App\Services\WalletService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class TransferController extends Controller
{
    public function __construct(private WalletService $walletService, private CinetPayTransferService $transferService)
    {
    }

    public function init(TransferInitRequest $request)
    {
        $user = $request->user();

        $rateKeyMinute = 'transfer:minute:' . $user->id;
        $rateKeyDay = 'transfer:day:' . $user->id . ':' . now()->toDateString();
        if (RateLimiter::tooManyAttempts($rateKeyMinute, 5)) {
            return response()->json(['message' => 'Trop de tentatives, réessaie plus tard'], 429);
        }
        if (RateLimiter::tooManyAttempts($rateKeyDay, 20)) {
            return response()->json(['message' => 'Quota quotidien atteint'], 429);
        }
        RateLimiter::hit($rateKeyMinute, 60);
        RateLimiter::hit($rateKeyDay, 86400);

        $data = $request->validated();
        $amount = (float) $data['amount'];
        $feeFlat = (float) env('WALLET_TRANSFER_FEE_FLAT', 0);
        $feePct = (float) env('WALLET_TRANSFER_FEE_PCT', 0);
        $fee = $feeFlat + ($feePct > 0 ? $amount * $feePct / 100 : 0);
        $totalDebit = $amount + $fee;

        $wallet = $this->walletService->getOrCreateWallet($user);
        $idempotencyKey = (string) Str::uuid();
        $reference = $idempotencyKey;

        try {
            $payout = DB::transaction(function () use ($user, $wallet, $data, $fee, $totalDebit, $idempotencyKey, $reference, $request) {
                $walletTx = $this->walletService->debitHold($user, $reference, $totalDebit, [
                    'reason' => 'payout',
                    'ip' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                ]);

                $payout = Payout::create([
                    'user_id' => $user->id,
                    'wallet_account_id' => $wallet->id,
                    'amount' => $data['amount'],
                    'fee' => $fee,
                    'total_debit' => $totalDebit,
                    'currency' => 'FCFA',
                    'country' => $data['country'],
                    'phone' => $data['phone'],
                    'provider' => 'CINETPAY',
                    'status' => 'queued',
                    'failure_reason' => null,
                    'idempotency_key' => $idempotencyKey,
                ]);

                AdminLog::create([
                    'admin_id' => null,
                    'action' => 'payout_init',
                    'details' => json_encode([
                        'payout_id' => $payout->id,
                        'user_id' => $user->id,
                        'amount' => $data['amount'],
                        'fee' => $fee,
                    ]),
                ]);

                return $payout->setRelation('walletTransaction', $walletTx);
            });
        } catch (\Throwable $e) {
            Log::warning('Payout init failed', ['error' => $e->getMessage(), 'user_id' => $user->id]);
            return response()->json(['message' => $e->getMessage() ?: 'Payout rejected'], 400);
        }

        ProcessPayout::dispatch($payout->id);

        return response()->json([
            'payout_id' => $payout->id,
            'status' => $payout->status,
        ]);
    }

    public function webhook(Request $request)
    {
        $payload = $request->all();
        if (!$this->transferService->validateWebhook($payload)) {
            return response()->json(['message' => 'Invalid signature'], 400);
        }

        $providerRef = $payload['transaction_id'] ?? null;
        $status = strtolower($payload['status'] ?? '');
        $idempotencyKey = $payload['idempotency_key'] ?? null;

        $payout = Payout::where('provider_ref', $providerRef)
            ->when(!$providerRef && $idempotencyKey, fn ($q) => $q->where('idempotency_key', $idempotencyKey))
            ->first();

        if (!$payout) {
            return response()->json(['message' => 'Payout not found'], 404);
        }

        if (in_array($payout->status, ['sent', 'failed'])) {
            return response()->json(['message' => 'Already processed']);
        }

        DB::transaction(function () use ($payout, $status, $payload) {
            $payout->events()->create([
                'provider_payload' => $payload,
                'status' => $status,
            ]);

            $walletTx = WalletTransaction::where('reference', $payout->idempotency_key)->first();
            if (!$walletTx) {
                $walletTx = WalletTransaction::where('wallet_account_id', $payout->wallet_account_id)
                    ->where('type', 'debit')
                    ->latest()
                    ->first();
            }

            if ($status === 'success') {
                $payout->update(['status' => 'sent', 'provider_ref' => $payload['transaction_id'] ?? $payout->provider_ref]);
                if ($walletTx) {
                    $this->walletService->debitCommit($walletTx);
                }
            } else {
                $payout->update(['status' => 'failed', 'failure_reason' => $payload['message'] ?? '']);
                if ($walletTx) {
                    $this->walletService->refund($payout->user, 'REF-' . $payout->id, (float) $payout->total_debit, [
                        'reason' => 'payout_failed',
                        'payout_id' => $payout->id,
                    ]);
                }
            }

            AdminLog::create([
                'admin_id' => null,
                'action' => 'payout_webhook',
                'details' => json_encode([
                    'payout_id' => $payout->id,
                    'status' => $payout->status,
                    'provider_ref' => $payout->provider_ref,
                ]),
            ]);
        });

        return response()->json(['message' => 'ok']);
    }
}
