<?php

namespace App\Jobs;

use App\Models\AdminLog;
use App\Models\Payout;
use App\Models\PayoutEvent;
use App\Models\WalletTransaction;
use App\Services\CinetPayTransferService;
use App\Services\WalletService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProcessPayout implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(private string $payoutId)
    {
    }

    public function handle(CinetPayTransferService $transferService, WalletService $walletService): void
    {
        $payout = Payout::with('user')->find($this->payoutId);
        if (!$payout) {
            return;
        }

        if (in_array($payout->status, ['sent', 'failed'])) {
            return;
        }

        DB::transaction(function () use ($payout) {
            $payout->update(['status' => 'processing']);
        });

        try {
            $result = $transferService->transfer((float) $payout->amount, $payout->phone, $payout->country, $payout->idempotency_key);

            DB::transaction(function () use ($payout, $result, $walletService) {
                $walletTx = WalletTransaction::where('reference', $payout->idempotency_key)->first();
                if (!$walletTx) {
                    $walletTx = WalletTransaction::where('wallet_account_id', $payout->wallet_account_id)
                        ->where('type', 'debit')
                        ->latest()
                        ->first();
                }

                $payout->update([
                    'status' => $result['status'] === 'success' ? 'sent' : 'processing',
                    'provider_ref' => $result['provider_ref'] ?? $payout->provider_ref,
                ]);

                $payout->events()->create([
                    'provider_payload' => $result['raw'] ?? null,
                    'status' => $result['status'] ?? 'processing',
                ]);

                if ($result['status'] === 'success' && $walletTx) {
                    $walletService->debitCommit($walletTx);
                }
            });
        } catch (\Throwable $e) {
            Log::error('Payout processing failed', ['payout_id' => $payout->id, 'error' => $e->getMessage()]);

            if ($this->attempts() >= $this->tries) {
                DB::transaction(function () use ($payout, $walletService) {
                    $payout->update(['status' => 'failed', 'failure_reason' => 'Transfer failed after retries']);
                    $walletService->refund($payout->user, 'REF-' . $payout->id, (float) $payout->total_debit, [
                        'reason' => 'payout_retry_failed',
                        'payout_id' => $payout->id,
                    ]);
                });
            } else {
                $this->release(30);
            }
        }

        AdminLog::create([
            'admin_id' => null,
            'action' => 'payout_process',
            'details' => json_encode([
                'payout_id' => $payout->id,
                'status' => $payout->status,
            ]),
        ]);
    }
}
