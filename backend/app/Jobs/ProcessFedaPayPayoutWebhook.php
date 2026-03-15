<?php

namespace App\Jobs;

use App\Mail\PartnerWithdrawPaid;
use App\Mail\TemplatedNotification;
use App\Models\PartnerWallet;
use App\Models\PartnerWalletTransaction;
use App\Models\PartnerWithdrawRequest;
use App\Models\Payout;
use App\Models\WalletTransaction;
use App\Services\FedaPayService;
use App\Services\LoggedEmailService;
use App\Services\WalletPayoutNotificationService;
use App\Services\WalletService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class ProcessFedaPayPayoutWebhook implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(private array $payload)
    {
    }

    public function handle(
        FedaPayService $fedaPayService,
        WalletService $walletService,
        WalletPayoutNotificationService $walletNotifier,
    ): void {
        $entity = Arr::get($this->payload, 'entity');
        if (!is_array($entity)) {
            $entity = $this->payload;
        }

        $custom = Arr::get($entity, 'custom_metadata');
        if (!is_array($custom)) {
            $custom = Arr::get($this->payload, 'custom_metadata');
        }
        if (!is_array($custom)) {
            $custom = [];
        }

        $normalized = $fedaPayService->normalizePayoutStatus($entity, (string) Arr::get($this->payload, 'name', ''));

        $walletPayoutId = is_string($custom['payout_id'] ?? null) ? $custom['payout_id'] : null;
        if ($walletPayoutId) {
            $this->applyWalletPayoutState($walletPayoutId, $entity, $normalized, $fedaPayService, $walletService, $walletNotifier);
        }

        $partnerWithdrawId = $custom['partner_withdraw_request_id'] ?? null;
        if (is_numeric($partnerWithdrawId)) {
            $this->applyPartnerWithdrawState((int) $partnerWithdrawId, $entity, $normalized);
        }
    }

    private function applyWalletPayoutState(
        string $payoutId,
        array $entity,
        string $normalized,
        FedaPayService $fedaPayService,
        WalletService $walletService,
        WalletPayoutNotificationService $walletNotifier,
    ): void {
        $transition = DB::transaction(function () use ($payoutId, $entity, $normalized, $fedaPayService) {
            $payout = Payout::query()->with('user')->whereKey($payoutId)->lockForUpdate()->first();
            if (!$payout) {
                return null;
            }

            $previous = (string) $payout->status;
            $reference = $fedaPayService->extractPayoutReference($entity);
            $providerId = $fedaPayService->extractPayoutId($entity);
            $failureReason = trim((string) (
                Arr::get($entity, 'last_error_code')
                ?? Arr::get($entity, 'data.last_error_code')
                ?? Arr::get($entity, '0.last_error_code')
                ?? ''
            ));
            $next = in_array($normalized, ['sent', 'failed', 'cancelled'], true) ? $normalized : 'processing';

            $payout->update([
                'provider' => 'FEDAPAY',
                'provider_ref' => $reference ?? ($providerId ? (string) $providerId : $payout->provider_ref),
                'status' => $next,
                'failure_reason' => in_array($next, ['failed', 'cancelled'], true)
                    ? ($failureReason !== '' ? $failureReason : ($payout->failure_reason ?? 'FedaPay payout failed'))
                    : null,
            ]);

            $payout->events()->create([
                'provider_payload' => $entity,
                'status' => $next,
            ]);

            return [$payout->fresh('user'), $previous, $next];
        });

        if (!$transition) {
            return;
        }

        /** @var Payout $payout */
        [$payout, $previous, $next] = $transition;

        if ($next === 'sent' && $previous !== 'sent') {
            $walletTx = WalletTransaction::query()->where('reference', $payout->idempotency_key)->first();
            if ($walletTx) {
                $walletService->debitCommit($walletTx);
            }
            $walletNotifier->notifySent($payout);
            return;
        }

        if (in_array($next, ['failed', 'cancelled'], true) && !in_array($previous, ['failed', 'cancelled'], true)) {
            $refundReference = 'REF-' . $payout->id;
            if (!WalletTransaction::query()->where('reference', $refundReference)->exists()) {
                $walletService->refund($payout->user, $refundReference, (float) $payout->total_debit, [
                    'reason' => 'payout_retry_failed',
                    'payout_id' => $payout->id,
                ]);
            }
            $walletNotifier->notifyFailed($payout, $payout->failure_reason);
        }
    }

    private function applyPartnerWithdrawState(int $withdrawId, array $entity, string $normalized): void
    {
        $transition = DB::transaction(function () use ($withdrawId, $entity, $normalized) {
            $withdraw = PartnerWithdrawRequest::query()
                ->with(['seller.user', 'partnerWallet'])
                ->whereKey($withdrawId)
                ->lockForUpdate()
                ->first();

            if (!$withdraw) {
                return null;
            }

            $wallet = PartnerWallet::query()->whereKey($withdraw->partner_wallet_id)->lockForUpdate()->first();
            if (!$wallet) {
                return null;
            }

            $details = is_array($withdraw->payout_details) ? $withdraw->payout_details : [];
            $amount = (float) $withdraw->amount;
            $fee = (float) ($details['withdraw_fee_amount'] ?? 0);
            $totalDebit = (float) ($details['withdraw_total_debit'] ?? ($amount + $fee));
            if ($totalDebit <= 0) {
                $totalDebit = $amount;
            }

            $details['provider'] = 'fedapay';
            $details['provider_payout_id'] = Arr::get($entity, 'id') ?? Arr::get($entity, '0.id');
            $details['provider_reference'] = Arr::get($entity, 'reference') ?? Arr::get($entity, '0.reference');
            $details['provider_status'] = $normalized;
            $details['provider_last_error_code'] = Arr::get($entity, 'last_error_code') ?? Arr::get($entity, '0.last_error_code');
            $details['provider_payload'] = $entity;

            $previous = (string) $withdraw->status;

            if ($normalized === 'sent' && $previous !== 'paid') {
                if ($totalDebit <= (float) $wallet->reserved_withdraw_balance) {
                    $wallet->reserved_withdraw_balance = (float) $wallet->reserved_withdraw_balance - $totalDebit;
                    $wallet->save();
                }

                $withdraw->status = 'paid';
                $withdraw->processed_at = now();
                $withdraw->payout_details = $details;
                $withdraw->save();

                $existingTx = PartnerWalletTransaction::query()
                    ->where('reference', 'partner_withdraw_paid_' . $withdraw->id)
                    ->exists();

                if (!$existingTx) {
                    PartnerWalletTransaction::create([
                        'partner_wallet_id' => $wallet->id,
                        'type' => 'debit_withdraw',
                        'amount' => $totalDebit,
                        'reference' => 'partner_withdraw_paid_' . $withdraw->id,
                        'meta' => [
                            'withdraw_request_id' => $withdraw->id,
                            'seller_id' => $withdraw->seller_id,
                            'withdraw_amount' => $amount,
                            'withdraw_fee_amount' => $fee,
                            'withdraw_total_debit' => $totalDebit,
                            'provider' => 'fedapay',
                            'provider_reference' => $details['provider_reference'] ?? null,
                        ],
                        'status' => 'success',
                    ]);
                }

                return ['paid', $withdraw->fresh(['seller.user', 'partnerWallet'])];
            }

            if (in_array($normalized, ['failed', 'cancelled'], true) && $previous === 'requested') {
                if ($totalDebit <= (float) $wallet->reserved_withdraw_balance) {
                    $wallet->reserved_withdraw_balance = (float) $wallet->reserved_withdraw_balance - $totalDebit;
                    $wallet->available_balance = (float) $wallet->available_balance + $totalDebit;
                    $wallet->save();
                }

                $withdraw->status = 'rejected';
                $withdraw->processed_at = now();
                $withdraw->admin_note = trim((string) ($details['provider_last_error_code'] ?? $withdraw->admin_note ?? 'Payout FedaPay échoué'));
                $withdraw->payout_details = $details;
                $withdraw->save();

                return ['failed', $withdraw->fresh(['seller.user', 'partnerWallet'])];
            }

            $withdraw->payout_details = $details;
            $withdraw->save();

            return ['processing', $withdraw->fresh(['seller.user', 'partnerWallet'])];
        });

        if (!$transition) {
            return;
        }

        [$state, $withdraw] = $transition;
        $user = $withdraw->seller?->user;
        if (!$user || !$user->email) {
            return;
        }

        try {
            /** @var LoggedEmailService $logged */
            $logged = app(LoggedEmailService::class);

            if ($state === 'paid') {
                $subject = 'Retrait payé - DB Partner';
                $logged->queue($user->id, $user->email, 'partner_withdraw_paid', $subject, new PartnerWithdrawPaid($withdraw), [
                    'withdraw_request_id' => $withdraw->id,
                ]);
                return;
            }

            if ($state === 'failed') {
                $reason = (string) ($withdraw->admin_note ?? 'Payout FedaPay échoué');
                $mailable = new TemplatedNotification(
                    'partner_withdraw_rejected',
                    'Retrait refusé - DB Partner',
                    [
                        'withdraw' => $withdraw->toArray(),
                        'user' => $user->toArray(),
                        'reason' => $reason,
                    ],
                    [
                        'title' => 'Retrait refusé - DB Partner',
                        'headline' => 'Retrait échoué',
                        'intro' => 'Le payout FedaPay a échoué. Le montant a été remis dans ton solde vendeur.',
                        'details' => [
                            ['label' => 'Montant', 'value' => number_format((float) $withdraw->amount, 0, ',', ' ') . ' FCFA'],
                            ['label' => 'Motif', 'value' => $reason],
                        ],
                        'actionUrl' => rtrim((string) (env('FRONTEND_URL', config('app.url'))), '/') . '/account/seller',
                        'actionText' => 'Voir mes retraits',
                    ]
                );

                $logged->queue($user->id, $user->email, 'partner_withdraw_rejected', 'Retrait refusé - DB Partner', $mailable, [
                    'withdraw_request_id' => $withdraw->id,
                ]);
            }
        } catch (\Throwable) {
        }
    }
}