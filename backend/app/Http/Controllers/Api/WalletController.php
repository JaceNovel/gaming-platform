<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WalletTransaction;
use App\Services\WalletService;
use Illuminate\Http\Request;

class WalletController extends Controller
{
    public function __construct(private WalletService $walletService)
    {
    }

    public function show(Request $request)
    {
        $wallet = $this->walletService->getOrCreateWallet($request->user());
        $transactions = $wallet->transactions()->latest()->limit(10)->get();

        return response()->json([
            'balance' => $wallet->balance,
            'reward_balance' => $wallet->reward_balance,
            'reward_min_purchase_amount' => $wallet->reward_min_purchase_amount,
            'currency' => $wallet->currency,
            'status' => $wallet->status,
            'transactions' => $transactions,
        ]);
    }

    public function transactions(Request $request)
    {
        $wallet = $this->walletService->getOrCreateWallet($request->user());
        $limit = max(1, min(50, (int) $request->query('limit', 10)));

        $rows = $wallet->transactions()->latest('created_at')->limit($limit)->get();

        $transactions = $rows->map(function (WalletTransaction $tx) use ($wallet) {
            $meta = is_array($tx->meta) ? $tx->meta : [];
            $typeHint = strtolower((string) ($meta['type'] ?? $meta['reason'] ?? ''));

            $label = match (true) {
                $typeHint === 'marketplace_account_refund' => 'Remboursement Account',
                $typeHint === 'order_refund' => 'Remboursement commande',
                $typeHint === 'admin_wallet_credit' => 'Crédit wallet (admin)',
                $typeHint === 'tournament_reward_credit' => 'Récompense tournoi',
                $typeHint === 'tournament_reward_payment' => 'Achat via wallet récompense',
                $typeHint === 'tournament_reward_exchange' => 'Échange récompense (-30%)',
                default => 'Transaction wallet',
            };

            $bucket = (string) ($tx->wallet_bucket ?? 'main');
            if ($bucket === 'reward' && $label === 'Transaction wallet') {
                $label = 'Transaction wallet récompense';
            }

            return [
                'id' => $tx->id,
                'label' => $label,
                'amount' => (float) $tx->amount,
                'currency' => $wallet->currency,
                'created_at' => optional($tx->created_at)->toIso8601String(),
                'type' => $tx->type,
                'status' => $tx->status,
                'reference' => $tx->reference,
                'wallet_bucket' => $bucket,
                'order_id' => null,
                'transaction_id' => null,
                'order_status' => null,
                'payment_status' => null,
            ];
        })->values();

        return response()->json([
            'transactions' => $transactions,
        ]);
    }
}
