<?php

namespace App\Jobs;

use App\Models\AdminLog;
use App\Models\Payout;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Services\MonerooService;
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
        MonerooService $monerooService,
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
                'provider' => 'MONEROO',
            ]);
        });

        try {
            $providerPayoutId = $this->resolveProviderPayoutId($payout, $monerooService);
            $latestProviderPayload = null;

            if (!$providerPayoutId) {
                $resolvedMethod = $monerooService->resolvePayoutMethodCode($this->resolveProviderMode($payout), (string) $payout->country);
                $created = $monerooService->initPayout($payout->user, [
                    'amount' => (float) $payout->amount,
                    'currency' => (string) $payout->currency,
                    'country' => (string) $payout->country,
                    'method' => $resolvedMethod,
                    'recipient_value' => (string) $payout->phone,
                    'customer_full_name' => (string) ($payout->user?->name ?? ''),
                    'customer_phone' => (string) $payout->phone,
                    'customer_country' => (string) $payout->country,
                    'customer_email' => $payout->user?->email,
                    'reference' => (string) $payout->idempotency_key,
                    'payout_id' => (string) $payout->id,
                    'description' => 'Retrait wallet ' . (string) $payout->id,
                    'metadata' => [
                        'source' => 'wallet_withdrawal',
                        'payout_id' => (string) $payout->id,
                        'wallet_account_id' => (string) $payout->wallet_account_id,
                        'user_id' => (string) $payout->user_id,
                    ],
                ]);

                $providerPayoutId = $monerooService->extractId($created);

                DB::transaction(function () use ($payout, $created, $providerPayoutId) {
                    $locked = Payout::query()->whereKey($payout->id)->lockForUpdate()->firstOrFail();
                    $locked->update([
                        'provider' => 'MONEROO',
                        'provider_ref' => $providerPayoutId !== '' ? $providerPayoutId : $locked->provider_ref,
                        'failure_reason' => null,
                    ]);
                    $locked->events()->create([
                        'provider_payload' => $created,
                        'status' => 'created',
                    ]);
                });

                $latestProviderPayload = $created;
            }

            if (
                $providerPayoutId
                && $payout
                && !in_array((string) $payout->status, ['sent', 'failed', 'cancelled'], true)
            ) {
                try {
                    $latestProviderPayload = $monerooService->verifyPayout($providerPayoutId);
                } catch (\Throwable $e) {
                    $message = strtolower(trim($e->getMessage()));
                    if (str_contains($message, 'payout transaction not found')) {
                        DB::transaction(function () use ($payout, $providerPayoutId, $latestProviderPayload) {
                            $locked = Payout::query()->whereKey($payout->id)->lockForUpdate()->firstOrFail();
                            $locked->update([
                                'status' => 'processing',
                                'provider' => 'MONEROO',
                                'provider_ref' => $providerPayoutId,
                            ]);

                            if (is_array($latestProviderPayload)) {
                                $locked->events()->create([
                                    'provider_payload' => $latestProviderPayload,
                                    'status' => 'processing',
                                ]);
                            }
                        });

                        $this->release(30);
                        return;
                    }

                    throw $e;
                }

                $this->applyProviderState($payout->id, $latestProviderPayload, $monerooService, $walletService, $notifier);
            }
        } catch (\Throwable $e) {
            Log::error('Payout processing failed', ['payout_id' => $payout->id, 'error' => $e->getMessage()]);

            if ($this->attempts() >= $this->tries) {
                $this->markFailed($payout->id, 'Transfer failed after retries', $walletService, $notifier);
            } else {
                $this->release(30);
            }
        }

        try {
            $adminId = $payout->user_id ?: User::query()->orderBy('id')->value('id');
            if ($adminId) {
                AdminLog::create([
                    'admin_id' => $adminId,
                    'action' => 'payout_process',
                    'details' => json_encode([
                        'payout_id' => $payout->id,
                        'status' => Payout::query()->whereKey($payout->id)->value('status'),
                    ]),
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('Payout admin log write failed', [
                'payout_id' => $payout->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function resolveProviderMode(Payout $payout): string
    {
        $meta = $this->walletTxMeta($payout);
        return strtolower((string) ($meta['payout_method'] ?? 'mobile_money'));
    }

    private function resolveProviderPayoutId(Payout $payout, MonerooService $monerooService): ?string
    {
        $payloads = $payout->events()
            ->latest('id')
            ->pluck('provider_payload');

        foreach ($payloads as $payload) {
            if (is_array($payload)) {
                $id = $monerooService->extractId($payload);
                if ($id) {
                    return $id;
                }
            }
        }

        $providerReference = trim((string) ($payout->provider_ref ?? ''));
        return $providerReference !== '' ? $providerReference : null;
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
        MonerooService $monerooService,
        WalletService $walletService,
        WalletPayoutNotificationService $notifier,
    ): void {
        $normalized = $monerooService->normalizePayoutStatus($providerPayload);
        $providerId = $monerooService->extractId($providerPayload);
        $failureReason = trim((string) (
            Arr::get($providerPayload, 'failure_message')
            ?? Arr::get($providerPayload, 'data.failure_message')
            ?? Arr::get($providerPayload, 'errors.0.message')
            ?? ''
        ));

        $transition = DB::transaction(function () use ($payoutId, $normalized, $providerPayload, $providerId, $failureReason) {
            $payout = Payout::query()->with('user')->whereKey($payoutId)->lockForUpdate()->firstOrFail();
            $previousStatus = (string) $payout->status;
            $nextStatus = in_array($normalized, ['sent', 'failed', 'cancelled'], true) ? $normalized : 'processing';

            $payout->update([
                'status' => $nextStatus,
                'provider' => 'MONEROO',
                'provider_ref' => $providerId !== '' ? $providerId : $payout->provider_ref,
                'failure_reason' => in_array($nextStatus, ['failed', 'cancelled'], true)
                    ? ($failureReason !== '' ? $failureReason : ($payout->failure_reason ?? 'Moneroo payout failed'))
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
