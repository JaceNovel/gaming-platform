<?php

namespace App\Services;

use App\Models\AdminLog;
use App\Models\User;
use App\Models\WalletAccount;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class WalletService
{
    public function getOrCreateWallet(User $user): WalletAccount
    {
        return WalletAccount::firstOrCreate(
            ['user_id' => $user->id],
            ['currency' => 'FCFA', 'balance' => 0, 'status' => 'active']
        );
    }

    public function getBalance(User $user): WalletAccount
    {
        return $this->getOrCreateWallet($user)->refresh();
    }

    public function credit(User $user, string $reference, float $amount, array $meta = []): WalletTransaction
    {
        return DB::transaction(function () use ($user, $reference, $amount, $meta) {
            $wallet = WalletAccount::where('user_id', $user->id)->lockForUpdate()->first();
            if (!$wallet) {
                $wallet = WalletAccount::create([
                    'user_id' => $user->id,
                    'currency' => 'FCFA',
                    'balance' => 0,
                    'status' => 'active',
                ]);
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

            AdminLog::create([
                'admin_id' => null,
                'action' => 'wallet_credit',
                'details' => json_encode(['user_id' => $user->id, 'amount' => $amount, 'reference' => $reference]),
            ]);

            return $tx;
        });
    }

    public function debitHold(User $user, string $reference, float $amount, array $meta = []): WalletTransaction
    {
        return DB::transaction(function () use ($user, $reference, $amount, $meta) {
            $wallet = WalletAccount::where('user_id', $user->id)->lockForUpdate()->first();
            if (!$wallet) {
                $wallet = WalletAccount::create([
                    'user_id' => $user->id,
                    'currency' => 'FCFA',
                    'balance' => 0,
                    'status' => 'active',
                ]);
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

    public function generateReference(string $prefix = 'WTX'): string
    {
        return $prefix . '-' . strtoupper(Str::random(10));
    }
}
