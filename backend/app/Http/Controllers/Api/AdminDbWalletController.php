<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendEmailJob;
use App\Mail\DbWalletCredited;
use App\Models\EmailLog;
use App\Models\WalletAccount;
use App\Models\WalletTransaction;
use App\Services\AdminAuditLogger;
use App\Services\WalletService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AdminDbWalletController extends Controller
{
    public function transactions(Request $request)
    {
        $query = WalletTransaction::query()
            ->with(['wallet.user'])
            ->latest('created_at');

        if ($request->filled('wallet_id')) {
            $walletId = trim((string) $request->query('wallet_id'));
            $query->whereHas('wallet', function ($q) use ($walletId) {
                $q->where('wallet_id', $walletId);
            });
        }

        if ($request->filled('email')) {
            $email = trim((string) $request->query('email'));
            $query->whereHas('wallet.user', function ($q) use ($email) {
                $q->where('email', $email);
            });
        }

        if ($request->filled('reference')) {
            $query->where('reference', trim((string) $request->query('reference')));
        }

        if ($request->filled('type')) {
            $query->where('type', trim((string) $request->query('type')));
        }

        if ($request->filled('status')) {
            $query->where('status', trim((string) $request->query('status')));
        }

        $perPage = max(1, min(100, (int) $request->query('per_page', 30)));

        return response()->json($query->paginate($perPage));
    }

    public function credit(Request $request, WalletService $walletService)
    {
        $validated = $request->validate([
            'wallet_id' => ['required', 'string', 'max:64'],
            'amount' => ['required', 'numeric', 'min:1'],
            // Simple anti-fraud: ask admin to confirm email before crediting.
            'verify_email' => ['required', 'string', 'email', 'max:255'],
            'reason' => ['nullable', 'string', 'max:191'],
        ]);

        $walletId = trim((string) $validated['wallet_id']);

        /** @var WalletAccount $wallet */
        $wallet = WalletAccount::with('user')->where('wallet_id', $walletId)->first();
        if (!$wallet) {
            return response()->json(['message' => 'Wallet introuvable'], 404);
        }

        if (!$wallet->user) {
            return response()->json(['message' => 'Utilisateur introuvable'], 404);
        }

        if (!empty($wallet->recharge_blocked_at)) {
            return response()->json([
                'message' => 'Recharges bloquées pour ce wallet.',
                'reason' => $wallet->recharge_blocked_reason,
            ], 423);
        }

        $verifyEmail = strtolower(trim((string) $validated['verify_email']));
        $userEmail = strtolower(trim((string) ($wallet->user->email ?? '')));
        if ($verifyEmail === '' || $userEmail === '' || $verifyEmail !== $userEmail) {
            return response()->json(['message' => 'Vérification email échouée'], 422);
        }

        $amount = (float) $validated['amount'];
        $reason = trim((string) ($validated['reason'] ?? ''));

        $reference = 'ADBWC-' . strtoupper(Str::random(10));

        $tx = DB::transaction(function () use ($walletService, $wallet, $reference, $amount, $reason, $request) {
            return $walletService->credit(
                $wallet->user,
                $reference,
                $amount,
                [
                    'type' => 'admin_dbwallet_credit',
                    'reason' => $reason !== '' ? $reason : 'admin_manual_credit',
                    'wallet_id' => $wallet->wallet_id,
                    'admin_id' => $request->user()?->id,
                ]
            );
        });

        // Email notification (best-effort)
        try {
            $mailable = new DbWalletCredited($wallet->fresh(['user']), $amount, $reference, $reason);

            $log = EmailLog::create([
                'user_id' => $wallet->user->id,
                'to' => $wallet->user->email,
                'type' => 'dbwallet_credited',
                'subject' => 'DBWallet crédité - BADBOYSHOP',
                'status' => 'queued',
            ]);

            SendEmailJob::dispatchSync($mailable, $log);
        } catch (\Throwable $e) {
            // ignore
        }

        // Audit log (best-effort)
        try {
            /** @var AdminAuditLogger $audit */
            $audit = app(AdminAuditLogger::class);
            $audit->log(
                $request->user(),
                'dbwallet_credit',
                [
                    'wallet_id' => $wallet->wallet_id,
                    'user_id' => $wallet->user->id,
                    'amount' => $amount,
                    'reference' => $reference,
                    'reason' => $reason,
                ],
                actionType: 'dbwallet',
                request: $request
            );
        } catch (\Throwable $e) {
            // ignore
        }

        return response()->json([
            'success' => true,
            'data' => [
                'wallet_id' => $wallet->wallet_id,
                'user_id' => $wallet->user->id,
                'reference' => $reference,
                'transaction_id' => $tx->id,
                'amount' => $amount,
                'balance' => (float) $wallet->fresh()->balance,
            ],
        ]);
    }

    public function blocked(Request $request)
    {
        $query = WalletAccount::query()
            ->with('user')
            ->whereNotNull('recharge_blocked_at')
            ->latest('recharge_blocked_at');

        if ($request->filled('wallet_id')) {
            $query->where('wallet_id', trim((string) $request->query('wallet_id')));
        }

        if ($request->filled('email')) {
            $email = trim((string) $request->query('email'));
            $query->whereHas('user', function ($q) use ($email) {
                $q->where('email', $email);
            });
        }

        $perPage = max(1, min(100, (int) $request->query('per_page', 30)));

        return response()->json($query->paginate($perPage));
    }

    public function block(Request $request)
    {
        $validated = $request->validate([
            'wallet_id' => ['required', 'string', 'max:64'],
            'reason' => ['nullable', 'string', 'max:191'],
        ]);

        $wallet = WalletAccount::with('user')->where('wallet_id', trim((string) $validated['wallet_id']))->first();
        if (!$wallet) {
            return response()->json(['message' => 'Wallet introuvable'], 404);
        }

        $wallet->recharge_blocked_at = now();
        $wallet->recharge_blocked_reason = trim((string) ($validated['reason'] ?? ''));
        $wallet->save();

        try {
            /** @var AdminAuditLogger $audit */
            $audit = app(AdminAuditLogger::class);
            $audit->log(
                $request->user(),
                'dbwallet_block_recharge',
                [
                    'wallet_id' => $wallet->wallet_id,
                    'user_id' => $wallet->user_id,
                    'reason' => $wallet->recharge_blocked_reason,
                ],
                actionType: 'dbwallet',
                request: $request
            );
        } catch (\Throwable $e) {
            // ignore
        }

        return response()->json([
            'success' => true,
            'data' => [
                'wallet_id' => $wallet->wallet_id,
                'recharge_blocked_at' => optional($wallet->recharge_blocked_at)->toIso8601String(),
                'recharge_blocked_reason' => $wallet->recharge_blocked_reason,
            ],
        ]);
    }

    public function unblock(Request $request)
    {
        $validated = $request->validate([
            'wallet_id' => ['required', 'string', 'max:64'],
        ]);

        $wallet = WalletAccount::with('user')->where('wallet_id', trim((string) $validated['wallet_id']))->first();
        if (!$wallet) {
            return response()->json(['message' => 'Wallet introuvable'], 404);
        }

        $wallet->recharge_blocked_at = null;
        $wallet->recharge_blocked_reason = null;
        $wallet->save();

        try {
            /** @var AdminAuditLogger $audit */
            $audit = app(AdminAuditLogger::class);
            $audit->log(
                $request->user(),
                'dbwallet_unblock_recharge',
                [
                    'wallet_id' => $wallet->wallet_id,
                    'user_id' => $wallet->user_id,
                ],
                actionType: 'dbwallet',
                request: $request
            );
        } catch (\Throwable $e) {
            // ignore
        }

        return response()->json([
            'success' => true,
            'data' => [
                'wallet_id' => $wallet->wallet_id,
                'recharge_blocked_at' => null,
                'recharge_blocked_reason' => null,
            ],
        ]);
    }
}
