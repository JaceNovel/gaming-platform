<?php

namespace App\Jobs;

use App\Models\WalletAccount;
use App\Models\WalletTransaction;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class HandleFedapayWebhookWallet implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public array $payload)
    {
    }

    public function handle(): void
    {
        try {
            $eventName = strtolower((string) data_get($this->payload, 'name', ''));
            $type = (string) (data_get($this->payload, 'entity.custom_metadata.type')
                ?? data_get($this->payload, 'custom_metadata.type')
                ?? '');

            if ($eventName !== 'transaction.approved' || $type !== 'wallet_topup') {
                return;
            }

            $walletTxId = (string) (data_get($this->payload, 'entity.custom_metadata.wallet_transaction_id')
                ?? data_get($this->payload, 'custom_metadata.wallet_transaction_id')
                ?? '');
            $userId = (int) (data_get($this->payload, 'entity.custom_metadata.user_id')
                ?? data_get($this->payload, 'custom_metadata.user_id')
                ?? 0);
            $amount = (float) data_get($this->payload, 'entity.amount', 0);
            $providerTxId = (string) data_get($this->payload, 'entity.id', '');
            $providerRef = (string) data_get($this->payload, 'entity.reference', '');

            Log::info('wallet_topup:received', [
                'event' => $eventName,
                'wallet_transaction_id' => $walletTxId !== '' ? $walletTxId : null,
                'user_id' => $userId ?: null,
                'amount' => $amount,
                'provider_tx_id' => $providerTxId !== '' ? $providerTxId : null,
                'provider_ref' => $providerRef !== '' ? $providerRef : null,
            ]);

            if ($walletTxId === '') {
                Log::warning('wallet_topup:error', ['reason' => 'missing_wallet_transaction_id']);
                return;
            }

            if (!Str::isUuid($walletTxId)) {
                Log::warning('wallet_topup:error', ['reason' => 'invalid_wallet_transaction_id', 'wallet_transaction_id' => $walletTxId]);
                return;
            }

            if ($amount <= 0) {
                Log::warning('wallet_topup:error', ['reason' => 'invalid_amount', 'amount' => $amount]);
                return;
            }

            if ($providerTxId === '') {
                Log::warning('wallet_topup:error', ['reason' => 'missing_provider_tx_id']);
                return;
            }

            // Cross-idempotency: if provider tx id already credited, do nothing.
            if (WalletTransaction::where('provider_transaction_id', $providerTxId)->where('status', 'success')->exists()) {
                Log::info('wallet_topup:already_paid', ['provider_tx_id' => $providerTxId]);
                return;
            }

            DB::transaction(function () use ($walletTxId, $amount, $providerTxId, $providerRef) {
                /** @var WalletTransaction|null $walletTx */
                $walletTx = WalletTransaction::whereKey($walletTxId)->lockForUpdate()->first();

                if (!$walletTx) {
                    Log::warning('wallet_topup:error', ['reason' => 'wallet_transaction_not_found', 'wallet_transaction_id' => $walletTxId]);
                    return;
                }

                if ((string) $walletTx->status === 'success') {
                    Log::info('wallet_topup:already_paid', ['wallet_transaction_id' => $walletTxId]);
                    return;
                }

                $existingProviderTxId = (string) ($walletTx->provider_transaction_id ?? '');
                if ($existingProviderTxId !== '') {
                    Log::info('wallet_topup:already_paid', [
                        'wallet_transaction_id' => $walletTxId,
                        'provider_tx_id' => $existingProviderTxId,
                    ]);
                    return;
                }

                /** @var WalletAccount|null $wallet */
                $wallet = WalletAccount::whereKey($walletTx->wallet_account_id)->lockForUpdate()->first();
                if (!$wallet) {
                    Log::warning('wallet_topup:error', ['reason' => 'wallet_not_found', 'wallet_account_id' => $walletTx->wallet_account_id]);
                    return;
                }

                $wallet->balance = (float) $wallet->balance + $amount;
                $wallet->save();

                $walletTx->status = 'success';
                $walletTx->provider = 'fedapay';
                $walletTx->provider_transaction_id = $providerTxId;
                $walletTx->provider_reference = $providerRef !== '' ? $providerRef : null;
                $walletTx->paid_at = now();
                $walletTx->save();

                Log::info('wallet_topup:credited', [
                    'wallet_transaction_id' => $walletTxId,
                    'wallet_account_id' => $walletTx->wallet_account_id,
                    'amount' => $amount,
                    'provider_tx_id' => $providerTxId,
                ]);
            });
        } catch (QueryException $e) {
            // Never throw (provider retry will happen via webhook, but we don't crash the worker).
            Log::error('wallet_topup:error', [
                'reason' => 'db',
                'message' => $e->getMessage(),
            ]);
        } catch (\Throwable $e) {
            Log::error('wallet_topup:error', [
                'reason' => 'exception',
                'message' => $e->getMessage(),
            ]);
        }
    }
}
