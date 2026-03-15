<?php

namespace App\Jobs;

use App\Models\AdminLog;
use App\Models\Payout;
use App\Models\WalletTransaction;
use App\Services\FedaPayService;
use App\Services\WalletService;
use App\Services\WalletPayoutNotificationService;
use Illuminate\Support\Arr;
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

    public function handle(
        FedaPayService $fedaPayService,
        WalletService $walletService,
        WalletPayoutNotificationService $notifier,
    ): void
    {
        $payout = Payout::with(['user', 'events'])->find($this->payoutId);
        if (!$payout) {
            return;
        }

        if (in_array((string) $payout->status, ['sent', 'failed', 'cancelled'], true)) {
            return;
        }

        DB::transaction(function () use ($payout) {
            $payout->update([
                'status' => 'processing',
                'provider' => 'FEDAPAY',
            ]);
        });

        try {
            $providerPayoutId = $this->resolveProviderPayoutId($payout, $fedaPayService);

            if (!$providerPayoutId) {
                $created = $fedaPayService->createPayout($payout->user, [
                    'amount' => (float) $payout->amount,
                    'currency' => (string) $payout->currency,
                    'mode' => $this->resolveProviderMode($payout),
                    'customer_phone' => $payout->phone,
                    'customer_country' => $payout->country,
                    'customer_name' => $payout->user?->name,
                    'customer_email' => $payout->user?->email,
                    'merchant_reference' => $payout->idempotency_key,
                    'metadata' => [
                        'source' => 'wallet_withdrawal',
                        'payout_id' => $payout->id,
                        'wallet_account_id' => $payout->wallet_account_id,
                    ],
                    'custom_metadata' => [
                        'user_id' => $payout->user_id,
                        'payout_id' => $payout->id,
                    ],
                ]);

                $providerPayoutId = $fedaPayService->extractPayoutId($created);
                $providerReference = $fedaPayService->extractPayoutReference($created);

                DB::transaction(function () use ($payout, $created, $providerReference) {
                    $locked = Payout::query()->whereKey($payout->id)->lockForUpdate()->firstOrFail();
                    $locked->update([
                        'provider' => 'FEDAPAY',
                        'provider_ref' => $providerReference ?? $locked->provider_ref,
                        'failure_reason' => null,
                    ]);
                    $locked->events()->create([
                        'provider_payload' => $created,
                        'status' => 'created',
                    ]);
                });

                $createdStatus = $fedaPayService->normalizePayoutStatus($created);
                if (in_array($createdStatus, ['sent', 'failed', 'cancelled'], true)) {
                    $this->applyProviderState($payout->id, $created, $fedaPayService, $walletService, $notifier);
                    $payout = Payout::with(['user', 'events'])->find($this->payoutId);
                    $providerPayoutId = $payout ? $this->resolveProviderPayoutId($payout, $fedaPayService) : $providerPayoutId;
                }
            }

            if (
                $providerPayoutId
                && $payout
                && !in_array((string) $payout->status, ['sent', 'failed', 'cancelled'], true)
                && !$this->hasStartBeenRequested($payout)
            ) {
                $started = $fedaPayService->startPayout([
                    [
                        'id' => $providerPayoutId,
                        'phone_number' => [
                            'number' => $payout->phone,
                            'country' => strtoupper((string) $payout->country),
                        ],
                    ],
                ]);

                DB::transaction(function () use ($payout, $started) {
                    $locked = Payout::query()->whereKey($payout->id)->lockForUpdate()->firstOrFail();
                    $locked->events()->create([
                        'provider_payload' => $started,
                        'status' => 'start_requested',
                    ]);
                });
            }

            if ($providerPayoutId) {
                $retrieved = $fedaPayService->retrievePayout($providerPayoutId);
                $this->applyProviderState($payout->id, $retrieved, $fedaPayService, $walletService, $notifier);
            }
        } catch (\Throwable $e) {
            Log::error('Payout processing failed', ['payout_id' => $payout->id, 'error' => $e->getMessage()]);

            if ($this->attempts() >= $this->tries) {
                $this->markFailed($payout->id, 'Transfer failed after retries', $walletService, $notifier);
            } else {
                $this->release(30);
            }
        }

        AdminLog::create([
            'admin_id' => null,
            'action' => 'payout_process',
            'details' => json_encode([
                'payout_id' => $payout->id,
                'status' => Payout::query()->whereKey($payout->id)->value('status'),
            ]),
        ]);
    }

    private function resolveProviderMode(Payout $payout): string
    {
        $meta = $this->walletTxMeta($payout);
        $method = strtolower((string) ($meta['payout_method'] ?? 'mobile_money'));

        return $method === 'bank' ? 'bank_transfer' : 'mobile_money';
    }

    private function resolveProviderPayoutId(Payout $payout, FedaPayService $fedaPayService): ?int
    {
        $payloads = $payout->events()
            ->latest('id')
            ->pluck('provider_payload');

        foreach ($payloads as $payload) {
            if (is_array($payload)) {
                $id = $fedaPayService->extractPayoutId($payload);
                if ($id) {
                    return $id;
                }
            }
        }

        if (is_numeric($payout->provider_ref)) {
            return (int) $payout->provider_ref;
        }

        return null;
    }

    private function hasStartBeenRequested(Payout $payout): bool
    {
        return $payout->events()
            ->where('status', 'start_requested')
            ->exists();
    }

    private function walletTxMeta(Payout $payout): array
    {
        $walletTx = $this->findWalletTransaction($payout);
        return is_array($walletTx?->meta) ? $walletTx->meta : [];
    }

    private function findWalletTransaction(Payout $payout): ?WalletTransaction
    {
        $walletTx = WalletTransaction::query()->where('reference', $payout->idempotency_key)->first();
        if ($walletTx) {
            return $walletTx;
        }

        return WalletTransaction::query()
            ->where('wallet_account_id', $payout->wallet_account_id)
            ->where('type', 'debit')
            ->latest('created_at')
            ->first();
    }

    private function applyProviderState(
        string $payoutId,
        array $providerPayload,
        FedaPayService $fedaPayService,
        WalletService $walletService,
        WalletPayoutNotificationService $notifier,
    ): void {
        $normalized = $fedaPayService->normalizePayoutStatus($providerPayload);
        $providerReference = $fedaPayService->extractPayoutReference($providerPayload);
        $providerId = $fedaPayService->extractPayoutId($providerPayload);
        $failureReason = trim((string) (
            Arr::get($providerPayload, 'last_error_code')
            ?? Arr::get($providerPayload, 'data.last_error_code')
            ?? Arr::get($providerPayload, '0.last_error_code')
            ?? ''
        ));

        $transition = DB::transaction(function () use ($payoutId, $normalized, $providerPayload, $providerReference, $providerId, $failureReason) {
            $payout = Payout::query()->with('user')->whereKey($payoutId)->lockForUpdate()->firstOrFail();
            $previousStatus = (string) $payout->status;
            $nextStatus = in_array($normalized, ['sent', 'failed', 'cancelled'], true) ? $normalized : 'processing';

            $payout->update([
                'status' => $nextStatus,
                'provider' => 'FEDAPAY',
                'provider_ref' => $providerReference ?? ($providerId ? (string) $providerId : $payout->provider_ref),
                'failure_reason' => in_array($nextStatus, ['failed', 'cancelled'], true)
                    ? ($failureReason !== '' ? $failureReason : ($payout->failure_reason ?? 'FedaPay payout failed'))
                    : null,
            ]);

            $payout->events()->create([
                'provider_payload' => $providerPayload,
                'status' => $nextStatus,
            ]);

            return [$payout->fresh(['user']), $previousStatus, $nextStatus];
        });

        /** @var Payout $payout */
        [$payout, $previousStatus, $nextStatus] = $transition;

        if ($nextStatus === 'sent' && $previousStatus !== 'sent') {
            $walletTx = $this->findWalletTransaction($payout);
            if ($walletTx) {
                $walletService->debitCommit($walletTx);
            }
            $notifier->notifySent($payout);
            return;
        }

        if (in_array($nextStatus, ['failed', 'cancelled'], true) && !in_array($previousStatus, ['failed', 'cancelled'], true)) {
            $refundReference = 'REF-' . $payout->id;
            $hasRefund = WalletTransaction::query()->where('reference', $refundReference)->exists();
            if (!$hasRefund) {
                $walletService->refund($payout->user, $refundReference, (float) $payout->total_debit, [
                    'reason' => 'payout_retry_failed',
                    'payout_id' => $payout->id,
                ]);
            }
            $notifier->notifyFailed($payout, $payout->failure_reason);
        }
    }

    private function markFailed(
        string $payoutId,
        string $reason,
        WalletService $walletService,
        WalletPayoutNotificationService $notifier,
    ): void {
        $transition = DB::transaction(function () use ($payoutId, $reason) {
            $payout = Payout::query()->with('user')->whereKey($payoutId)->lockForUpdate()->firstOrFail();
            $previousStatus = (string) $payout->status;

            if (in_array($previousStatus, ['sent', 'failed', 'cancelled'], true)) {
                return [$payout, $previousStatus, $previousStatus];
            }

            $payout->update([
                'status' => 'failed',
                'failure_reason' => $reason,
            ]);

            $payout->events()->create([
                'provider_payload' => ['error' => $reason],
                'status' => 'failed',
            ]);

            return [$payout->fresh(['user']), $previousStatus, 'failed'];
        });

        /** @var Payout $payout */
        [$payout, $previousStatus, $nextStatus] = $transition;

        if ($nextStatus !== 'failed' || $previousStatus === 'failed') {
            return;
        }

        $refundReference = 'REF-' . $payout->id;
        $hasRefund = WalletTransaction::query()->where('reference', $refundReference)->exists();
        if (!$hasRefund) {
            $walletService->refund($payout->user, $refundReference, (float) $payout->total_debit, [
                'reason' => 'payout_retry_failed',
                'payout_id' => $payout->id,
            ]);
        }

        $notifier->notifyFailed($payout, $reason);
    }
}
