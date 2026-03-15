<?php

namespace App\Services;

use App\Models\AdminLog;
use App\Models\Notification;
use App\Models\User;
use App\Models\WalletAccount;
use App\Models\WalletTransaction;
use App\Services\WebPushService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class WalletService
{
    public function generateWalletId(): string
    {
        return 'DBW-' . (string) Str::ulid();
    }

    public function getOrCreateWallet(User $user): WalletAccount
    {
        $wallet = WalletAccount::firstOrCreate(
            ['user_id' => $user->id],
            [
                'wallet_id' => $this->generateWalletId(),
                'currency' => 'FCFA',
                'balance' => 0,
                'bonus_balance' => 0,
                'reward_balance' => 0,
                'reward_min_purchase_amount' => null,
                'bonus_expires_at' => null,
                'status' => 'active',
            ]
        );

        if (empty($wallet->wallet_id)) {
            $wallet->wallet_id = $this->generateWalletId();
            $wallet->save();
        }

        return $wallet;
    }

    public function getBalance(User $user): WalletAccount
    {
        return $this->getOrCreateWallet($user)->refresh();
    }

    public function credit(User $user, string $reference, float $amount, array $meta = []): WalletTransaction
    {
        $tx = DB::transaction(function () use ($user, $reference, $amount, $meta) {
            $adminId = array_key_exists('admin_id', $meta) ? $meta['admin_id'] : null;

            $wallet = WalletAccount::where('user_id', $user->id)->lockForUpdate()->first();
            if (!$wallet) {
                $wallet = WalletAccount::create([
                    'user_id' => $user->id,
                    'wallet_id' => $this->generateWalletId(),
                    'currency' => 'FCFA',
                    'balance' => 0,
                    'bonus_balance' => 0,
                    'reward_balance' => 0,
                    'reward_min_purchase_amount' => null,
                    'bonus_expires_at' => null,
                    'status' => 'active',
                ]);
                $wallet = WalletAccount::where('id', $wallet->id)->lockForUpdate()->first();
            }

            // Ensure legacy wallets get a wallet_id.
            if (empty($wallet->wallet_id)) {
                $wallet->wallet_id = $this->generateWalletId();
                $wallet->save();
                $wallet = WalletAccount::where('id', $wallet->id)->lockForUpdate()->first();
            }
            $tx = WalletTransaction::where('reference', $reference)->first();
            if ($tx && $tx->status === 'success') {
                return $tx;
            }

            if (!$tx) {
                $tx = WalletTransaction::create([
                    'wallet_account_id' => $wallet->id,
                    'type' => 'credit',
                    'amount' => $amount,
                    'reference' => $reference,
                    'meta' => $meta,
                    'status' => 'pending',
                ]);
            }

            $wallet->balance = $wallet->balance + $amount;
            $wallet->save();

            $tx->status = 'success';
            $tx->save();

            try {
                AdminLog::create([
                    'admin_id' => is_numeric($adminId) ? (int) $adminId : null,
                    'action' => 'wallet_credit',
                    'details' => json_encode(['user_id' => $user->id, 'amount' => $amount, 'reference' => $reference]),
                ]);
            } catch (Throwable $e) {
                // Best-effort audit log (never block wallet credit).
                Log::warning('wallet:admin-log-skipped', [
                    'user_id' => $user->id,
                    'reference' => $reference,
                    'error' => $e->getMessage(),
                ]);
            }

            return $tx;
        });

        // Best-effort web push (never block credit).
        try {
            $reason = (string) ($meta['reason'] ?? '');
            $type = (string) ($meta['type'] ?? '');
            $shouldNotify = $reason === 'topup' || in_array($type, ['referral_bonus', 'vip_referral_bonus'], true);
            if ($shouldNotify) {
                /** @var WebPushService $webPush */
                $webPush = app(WebPushService::class);
                $label = $reason === 'topup'
                    ? 'Wallet rechargé'
                    : 'Commission parrainage';

                $webPush->sendToUser($user, [
                    'title' => 'PRIME Gaming',
                    'body' => $label . ' : +' . number_format($amount, 0, ',', ' ') . ' FCFA',
                    'url' => '/wallet',
                ]);
            }
        } catch (Throwable $e) {
            Log::warning('WebPush notification skipped', [
                'user_id' => $user->id,
                'reference' => $reference,
                'error' => $e->getMessage(),
            ]);
        }

        return $tx;
    }

    public function debitHold(User $user, string $reference, float $amount, array $meta = []): WalletTransaction
    {
        return DB::transaction(function () use ($user, $reference, $amount, $meta) {
            $wallet = WalletAccount::where('user_id', $user->id)->lockForUpdate()->first();
            if (!$wallet) {
                $wallet = WalletAccount::create([
                    'user_id' => $user->id,
                    'wallet_id' => $this->generateWalletId(),
                    'currency' => 'FCFA',
                    'balance' => 0,
                    'bonus_balance' => 0,
                    'reward_balance' => 0,
                    'reward_min_purchase_amount' => null,
                    'bonus_expires_at' => null,
                    'status' => 'active',
                ]);
                $wallet = WalletAccount::where('id', $wallet->id)->lockForUpdate()->first();
            }
            if (empty($wallet->wallet_id)) {
                $wallet->wallet_id = $this->generateWalletId();
                $wallet->save();
                $wallet = WalletAccount::where('id', $wallet->id)->lockForUpdate()->first();
            }
            if ($wallet->status === 'locked') {
                throw new \RuntimeException('Wallet locked');
            }

            $existing = WalletTransaction::where('reference', $reference)->first();
            if ($existing) {
                return $existing;
            }

            if ($wallet->balance < $amount) {
                throw new \RuntimeException('Insufficient balance');
            }

            $wallet->balance = $wallet->balance - $amount;
            $wallet->save();

            $tx = WalletTransaction::create([
                'wallet_account_id' => $wallet->id,
                'type' => 'debit',
                'amount' => $amount,
                'reference' => $reference,
                'meta' => $meta,
                'status' => 'pending',
            ]);

            return $tx;
        });
    }

    public function debitCommit(WalletTransaction $transaction): void
    {
        DB::transaction(function () use ($transaction) {
            $tx = WalletTransaction::where('id', $transaction->id)->lockForUpdate()->first();
            if (!$tx || $tx->status === 'success') {
                return;
            }
            $tx->status = 'success';
            $tx->save();
        });
    }

    public function refund(User $user, string $reference, float $amount, array $meta = []): WalletTransaction
    {
        return DB::transaction(function () use ($user, $reference, $amount, $meta) {
            $wallet = WalletAccount::where('user_id', $user->id)->lockForUpdate()->firstOrFail();

            if (empty($wallet->wallet_id)) {
                $wallet->wallet_id = $this->generateWalletId();
                $wallet->save();
                $wallet = WalletAccount::where('id', $wallet->id)->lockForUpdate()->firstOrFail();
            }

            $tx = WalletTransaction::create([
                'wallet_account_id' => $wallet->id,
                'type' => 'credit',
                'amount' => $amount,
                'reference' => $reference,
                'meta' => $meta,
                'status' => 'success',
            ]);

            $wallet->balance = $wallet->balance + $amount;
            $wallet->save();

            return $tx;
        });
    }

    public function bonusIsActive(WalletAccount $wallet): bool
    {
        $balance = (float) ($wallet->bonus_balance ?? 0);
        if ($balance <= 0) return false;
        if (!$wallet->bonus_expires_at) return false;
        return $wallet->bonus_expires_at->isFuture();
    }

    public function generateReference(string $prefix = 'WTX'): string
    {
        return $prefix . '-' . strtoupper(Str::random(10));
    }

    public function transfer(User $sender, User $recipient, string $reference, float $amount, array $meta = []): array
    {
        if ($amount <= 0) {
            throw new \RuntimeException('Transfer amount must be greater than zero');
        }

        if ((int) $sender->id === (int) $recipient->id) {
            throw new \RuntimeException('Cannot transfer to self');
        }

        $result = DB::transaction(function () use ($sender, $recipient, $reference, $amount, $meta) {
            $senderWallet = $this->getOrCreateWallet($sender);
            $recipientWallet = $this->getOrCreateWallet($recipient);

            $walletIds = [$senderWallet->id, $recipientWallet->id];
            sort($walletIds);

            $locked = WalletAccount::query()
                ->whereIn('id', $walletIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            /** @var WalletAccount $lockedSender */
            $lockedSender = $locked->get($senderWallet->id);
            /** @var WalletAccount $lockedRecipient */
            $lockedRecipient = $locked->get($recipientWallet->id);

            if (!$lockedSender || !$lockedRecipient) {
                throw new \RuntimeException('Wallet not found');
            }

            if ((string) $lockedSender->status === 'locked') {
                throw new \RuntimeException('Sender wallet locked');
            }

            if ((string) $lockedRecipient->status === 'locked') {
                throw new \RuntimeException('Recipient wallet locked');
            }

            $outReference = $reference . '-OUT';
            $inReference = $reference . '-IN';

            $existingOut = WalletTransaction::query()->where('reference', $outReference)->first();
            $existingIn = WalletTransaction::query()->where('reference', $inReference)->first();
            if ($existingOut && $existingIn) {
                return [
                    'sender_wallet' => $lockedSender->fresh(),
                    'recipient_wallet' => $lockedRecipient->fresh(),
                    'debit' => $existingOut,
                    'credit' => $existingIn,
                ];
            }

            if ((float) $lockedSender->balance < $amount) {
                throw new \RuntimeException('Insufficient balance');
            }

            $transferMeta = array_merge($meta, [
                'type' => 'wallet_transfer',
                'reason' => 'wallet_transfer',
                'sender_user_id' => $sender->id,
                'sender_wallet_id' => $lockedSender->wallet_id,
                'sender_username' => $sender->name,
                'recipient_user_id' => $recipient->id,
                'recipient_wallet_id' => $lockedRecipient->wallet_id,
                'recipient_username' => $recipient->name,
                'transfer_reference' => $reference,
            ]);

            $lockedSender->balance = (float) $lockedSender->balance - $amount;
            $lockedSender->save();

            $lockedRecipient->balance = (float) $lockedRecipient->balance + $amount;
            $lockedRecipient->save();

            $debit = WalletTransaction::create([
                'wallet_account_id' => $lockedSender->id,
                'type' => 'debit',
                'amount' => $amount,
                'reference' => $outReference,
                'meta' => $transferMeta,
                'status' => 'success',
            ]);

            $credit = WalletTransaction::create([
                'wallet_account_id' => $lockedRecipient->id,
                'type' => 'credit',
                'amount' => $amount,
                'reference' => $inReference,
                'meta' => $transferMeta,
                'status' => 'success',
            ]);

            return [
                'sender_wallet' => $lockedSender->fresh(),
                'recipient_wallet' => $lockedRecipient->fresh(),
                'debit' => $debit,
                'credit' => $credit,
            ];
        });

        try {
            Notification::create([
                'user_id' => $recipient->id,
                'type' => 'wallet_transfer_received',
                'message' => $sender->name . ' t\'a envoyé ' . number_format($amount, 0, ',', ' ') . ' FCFA sur ton DB Wallet.',
            ]);
        } catch (Throwable $e) {
            Log::warning('wallet:transfer-notification-skipped', [
                'reference' => $reference,
                'recipient_user_id' => $recipient->id,
                'error' => $e->getMessage(),
            ]);
        }

        return $result;
    }
}
