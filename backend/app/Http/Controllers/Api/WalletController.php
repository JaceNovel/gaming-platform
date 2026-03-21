<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\WalletTopupRequest;
use App\Jobs\ProcessPayout;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Payout;
use App\Models\User;
use App\Models\WalletAccount;
use App\Models\WalletTransaction;
use App\Services\FedaPayService;
use App\Services\MonerooService;
use App\Services\PayPalService;
use App\Services\WalletService;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class WalletController extends Controller
{
    private const WITHDRAW_FEE_AMOUNT = 1000.0;

    public function __construct(
        private WalletService $walletService,
        private FedaPayService $fedaPayService,
        private MonerooService $monerooService,
        private PayPalService $payPalService,
    )
    {
    }

    public function show(Request $request)
    {
        $wallet = $this->walletService->getOrCreateWallet($request->user());
        $this->syncPendingPayouts($wallet);
        $wallet = $wallet->fresh();
        $transactions = $wallet->transactions()->latest()->limit(10)->get();
        $payouts = $wallet->payouts()->latest()->limit(10)->get()->map(fn (Payout $payout) => $this->mapPayout($payout))->values();

        return response()->json([
            'wallet_id' => $wallet->wallet_id,
            'username' => $request->user()->name,
            'balance' => $wallet->balance,
            'reward_balance' => $wallet->reward_balance,
            'reward_min_purchase_amount' => $wallet->reward_min_purchase_amount,
            'currency' => $wallet->currency,
            'status' => $wallet->status,
            'transactions' => $transactions,
            'withdraw_fee_amount' => self::WITHDRAW_FEE_AMOUNT,
            'payouts' => $payouts,
            'payout_support' => $this->monerooService->payoutSupport(),
        ]);
    }

    public function transactions(Request $request)
    {
        $wallet = $this->walletService->getOrCreateWallet($request->user());
        $this->syncPendingPayouts($wallet);
        $wallet = $wallet->fresh();
        $limit = max(1, min(50, (int) $request->query('limit', 10)));

        $rows = $wallet->transactions()->latest('created_at')->limit($limit)->get();
        $payoutIds = $rows
            ->map(fn (WalletTransaction $tx) => is_array($tx->meta) ? ($tx->meta['payout_id'] ?? null) : null)
            ->filter(fn ($value) => is_string($value) && $value !== '')
            ->unique()
            ->values();

        $payouts = Payout::query()
            ->whereIn('id', $payoutIds)
            ->get()
            ->keyBy('id');

        $transactions = $rows->map(function (WalletTransaction $tx) use ($wallet, $payouts) {
            $meta = is_array($tx->meta) ? $tx->meta : [];
            $typeHint = strtolower((string) ($meta['type'] ?? $meta['reason'] ?? ''));

            $label = match (true) {
                $typeHint === 'marketplace_account_refund' => 'Remboursement Account',
                $typeHint === 'order_refund' => 'Remboursement commande',
                $typeHint === 'admin_wallet_credit' => 'Crédit wallet (admin)',
                $typeHint === 'topup' => 'Recharge wallet',
                $typeHint === 'wallet_topup' => 'Recharge wallet',
                $typeHint === 'wallet_withdrawal' => 'Retrait wallet',
                $typeHint === 'payout_retry_failed' => 'Remboursement retrait wallet',
                $typeHint === 'wallet_transfer' && $tx->type === 'debit' => 'Envoi DB Wallet',
                $typeHint === 'wallet_transfer' && $tx->type === 'credit' => 'Réception DB Wallet',
                $typeHint === 'tournament_reward_credit' => 'Récompense tournoi',
                $typeHint === 'tournament_reward_payment' => 'Achat via wallet récompense',
                $typeHint === 'tournament_reward_exchange' => 'Échange récompense (-30%)',
                default => 'Transaction wallet',
            };

            if ($label === 'Transaction wallet') {
                $reference = strtoupper((string) ($tx->reference ?? ''));
                if (str_starts_with($reference, 'WTOPUP-')) {
                    $label = 'Recharge wallet';
                } elseif (str_starts_with($reference, 'PAYOUT-')) {
                    $label = 'Retrait wallet';
                }
            }

            $bucket = (string) ($tx->wallet_bucket ?? 'main');
            if ($bucket === 'reward' && $label === 'Transaction wallet') {
                $label = 'Transaction wallet récompense';
            }

            $payout = null;
            $payoutId = $meta['payout_id'] ?? null;
            if (is_string($payoutId) && $payoutId !== '') {
                $payout = $payouts->get($payoutId);
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
                'payout_id' => $payout?->id,
                'payout_status' => $payout?->status,
                'failure_reason' => $payout?->failure_reason,
                'transfer_reference' => $meta['transfer_reference'] ?? null,
                'counterparty_wallet_id' => $tx->type === 'debit'
                    ? ($meta['recipient_wallet_id'] ?? null)
                    : ($meta['sender_wallet_id'] ?? null),
                'counterparty_username' => $tx->type === 'debit'
                    ? ($meta['recipient_username'] ?? null)
                    : ($meta['sender_username'] ?? null),
            ];
        })->values();

        return response()->json([
            'transactions' => $transactions,
        ]);
    }

    public function payouts(Request $request)
    {
        $wallet = $this->walletService->getOrCreateWallet($request->user());
        $this->syncPendingPayouts($wallet);
        $wallet = $wallet->fresh();
        $limit = max(1, min(50, (int) $request->query('limit', 10)));

        $payouts = $wallet->payouts()
            ->latest('created_at')
            ->limit($limit)
            ->get()
            ->map(fn (Payout $payout) => $this->mapPayout($payout))
            ->values();

        return response()->json([
            'payouts' => $payouts,
            'withdraw_fee_amount' => self::WITHDRAW_FEE_AMOUNT,
        ]);
    }

    public function resolveRecipient(Request $request)
    {
        $data = $request->validate([
            'query' => ['required', 'string', 'min:2', 'max:64'],
        ]);

        $sender = $request->user();
        $recipient = $this->findRecipient((string) $data['query'], $sender->id);
        if (!$recipient) {
            return response()->json([
                'message' => 'Aucun utilisateur trouvé pour cet identifiant.',
            ], 404);
        }

        $wallet = $this->walletService->getOrCreateWallet($recipient);

        return response()->json([
            'recipient' => $this->mapRecipient($recipient, $wallet),
        ]);
    }

    public function transfer(Request $request)
    {
        $sender = $request->user();
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
            'recipient_query' => ['required', 'string', 'min:2', 'max:64'],
        ]);

        $amount = round((float) $data['amount'], 2);
        $recipient = $this->findRecipient((string) $data['recipient_query'], $sender->id);
        if (!$recipient) {
            throw ValidationException::withMessages([
                'recipient_query' => ['Aucun utilisateur trouvé pour cet identifiant.'],
            ]);
        }

        if ((int) $recipient->id === (int) $sender->id) {
            throw ValidationException::withMessages([
                'recipient_query' => ['Tu ne peux pas t\'envoyer de l\'argent à toi-même.'],
            ]);
        }

        try {
            $reference = 'WTR-' . strtoupper(Str::random(10));
            $result = $this->walletService->transfer($sender, $recipient, $reference, $amount, [
                'initiator' => 'wallet_page',
                'recipient_query' => trim((string) $data['recipient_query']),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Transfert envoyé sans frais.',
                'data' => [
                    'wallet_balance' => (float) $result['sender_wallet']->balance,
                    'reference' => $reference,
                    'recipient' => $this->mapRecipient($recipient, $result['recipient_wallet']),
                ],
            ], 201);
        } catch (\RuntimeException $e) {
            $message = match ($e->getMessage()) {
                'Insufficient balance' => 'Solde insuffisant.',
                'Sender wallet locked' => 'Ton wallet est verrouillé.',
                'Recipient wallet locked' => 'Le wallet destinataire est verrouillé.',
                default => 'Transfert impossible.',
            };

            throw ValidationException::withMessages([
                'amount' => [$message],
            ]);
        }
    }

    public function topup(WalletTopupRequest $request)
    {
        $user = $request->user();
        $wallet = $this->walletService->getOrCreateWallet($user);

        if ((string) ($wallet->status ?? '') === 'locked') {
            return response()->json(['message' => 'Wallet verrouillé.'], 423);
        }

        if ($wallet->recharge_blocked_at) {
            return response()->json([
                'message' => $wallet->recharge_blocked_reason ?: 'Les recharges wallet sont temporairement bloquées.',
            ], 423);
        }

        $amount = round((float) $request->validated()['amount'], 2);
        $requestedProvider = strtolower(trim((string) ($request->validated()['provider'] ?? 'moneroo')));
        $provider = 'moneroo';
        $customerPhone = trim((string) ($request->validated()['customer_phone'] ?? $user->phone ?? ''));
        $customerCountry = strtoupper(trim((string) ($request->validated()['customer_country'] ?? $user->country_code ?? 'CI')));
        $throttleKey = sprintf('wallet:topup:init:%s:%s:%s', $user->id, $provider, number_format($amount, 2, '.', ''));

        $order = null;
        $payment = null;
        $walletTx = null;

        try {
            $existingPendingTopup = $this->findReusablePendingTopup($user, $amount);
            if ($existingPendingTopup) {
                return response()->json([
                    'success' => true,
                    'reused' => true,
                    'data' => $existingPendingTopup,
                ]);
            }

            if (!Cache::add($throttleKey, now()->toIso8601String(), now()->addSeconds(15))) {
                $existingPendingTopup = $this->findReusablePendingTopup($user, $amount);
                if ($existingPendingTopup) {
                    return response()->json([
                        'success' => true,
                        'reused' => true,
                        'data' => $existingPendingTopup,
                    ]);
                }

                return response()->json([
                    'message' => 'Une recharge est deja en cours. Patiente quelques secondes.',
                ], 429);
            }

            ['order' => $order, 'payment' => $payment, 'walletTx' => $walletTx] = DB::transaction(function () use ($user, $wallet, $amount, $provider) {
                $reference = 'WTU-' . strtoupper(Str::random(10));

                $order = Order::create([
                    'user_id' => $user->id,
                    'type' => 'wallet_topup',
                    'status' => Order::STATUS_PAYMENT_PROCESSING,
                    'total_price' => $amount,
                    'items' => [],
                    'meta' => [
                        'type' => 'wallet_topup',
                        'source' => 'wallet_page',
                        'wallet_id' => $wallet->wallet_id,
                        'wallet_account_id' => $wallet->id,
                    ],
                    'reference' => $reference,
                ]);

                $walletTx = WalletTransaction::create([
                    'wallet_account_id' => $wallet->id,
                    'type' => 'credit',
                    'amount' => $amount,
                    'reference' => 'WTOPUP-' . $reference,
                    'meta' => [
                        'type' => 'wallet_topup',
                        'reason' => 'topup',
                        'order_id' => $order->id,
                    ],
                    'status' => 'pending',
                    'provider' => $provider,
                ]);

                $payment = Payment::create([
                    'order_id' => $order->id,
                    'wallet_transaction_id' => $walletTx->id,
                    'amount' => $amount,
                    'method' => 'moneroo',
                    'status' => 'pending',
                    'webhook_data' => [
                        'source' => 'wallet_topup',
                        'provider' => 'moneroo',
                        'requested_provider' => $requestedProvider,
                    ],
                ]);

                $order->payment_id = $payment->id;
                $order->save();

                return [
                    'order' => $order,
                    'payment' => $payment,
                    'walletTx' => $walletTx,
                ];
            });

            $initResult = $this->monerooService->initPayment($order, $user, [
                'amount' => $amount,
                'currency' => 'XOF',
                'description' => 'Recharge DB Wallet',
                'customer_full_name' => $user->name,
                'customer_phone' => $customerPhone,
                'customer_country' => $customerCountry,
                'customer_email' => $user->email,
                'return_url' => route('api.payments.moneroo.return', [
                    'order_id' => $order->id,
                    'provider' => 'moneroo',
                ]),
                'metadata' => [
                    'type' => 'wallet_topup',
                    'order_id' => (string) $order->id,
                    'wallet_transaction_id' => (string) $walletTx->id,
                    'user_id' => (string) $user->id,
                ],
            ]);

            DB::transaction(function () use ($order, $payment, $initResult, $amount) {
                $paymentMeta = $payment->webhook_data ?? [];
                if (!is_array($paymentMeta)) {
                    $paymentMeta = [];
                }
                $paymentMeta['init_response'] = $initResult['raw'] ?? null;
                if (isset($initResult['provider_currency'])) {
                    $paymentMeta['provider_currency'] = $initResult['provider_currency'];
                }
                if (isset($initResult['provider_amount'])) {
                    $paymentMeta['provider_amount'] = $initResult['provider_amount'];
                }

                $payment->update([
                    'transaction_id' => (string) ($initResult['transaction_id'] ?? $initResult['order_id'] ?? ''),
                    'webhook_data' => $paymentMeta,
                ]);

                PaymentAttempt::updateOrCreate(
                    ['transaction_id' => (string) ($initResult['transaction_id'] ?? $initResult['order_id'] ?? '')],
                    [
                        'order_id' => $order->id,
                        'amount' => (float) ($initResult['provider_amount'] ?? $amount),
                        'currency' => (string) ($initResult['provider_currency'] ?? 'XOF'),
                        'status' => 'pending',
                        'provider' => (string) ($payment->method ?? 'moneroo'),
                        'raw_payload' => [
                            'source' => 'wallet_topup',
                            'init_response' => $initResult['raw'] ?? null,
                        ],
                    ]
                );
            });

            return response()->json([
                'success' => true,
                'data' => [
                    'payment_url' => (string) ($initResult['payment_url'] ?? $initResult['approve_url'] ?? ''),
                    'transaction_id' => (string) ($initResult['transaction_id'] ?? $initResult['order_id'] ?? ''),
                    'payment_id' => $payment->id,
                    'order_id' => $order->id,
                    'wallet_transaction_id' => $walletTx->id,
                    'amount' => $amount,
                    'currency' => 'XOF',
                    'provider_currency' => $initResult['provider_currency'] ?? 'XOF',
                    'provider_amount' => $initResult['provider_amount'] ?? $amount,
                    'provider' => 'moneroo',
                    'status' => 'pending',
                ],
            ]);
        } catch (\Throwable $e) {
            if ($order && $payment && $walletTx) {
                DB::transaction(function () use ($order, $payment, $walletTx, $e) {
                    $walletTx->update(['status' => 'failed']);
                    $payment->update([
                        'status' => 'failed',
                        'webhook_data' => array_merge(is_array($payment->webhook_data) ? $payment->webhook_data : [], [
                            'error' => $e->getMessage(),
                        ]),
                    ]);
                    $order->update(['status' => Order::STATUS_PAYMENT_FAILED]);
                });
            }

            Log::error('wallet:topup-init-failed', [
                'user_id' => $user->id,
                'wallet_id' => $wallet->wallet_id,
                'amount' => $amount,
                'provider' => $provider,
                'requested_provider' => $requestedProvider,
                'order_id' => $order?->id,
                'payment_id' => $payment?->id,
                'wallet_transaction_id' => $walletTx?->id,
                'message' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);

            $safeMessage = $this->mapTopupFailureMessage($e);

            return response()->json([
                'message' => config('app.debug')
                    ? ('Recharge impossible: ' . $e->getMessage())
                    : $safeMessage,
            ], 502);
        } finally {
            Cache::forget($throttleKey);
        }
    }

    public function requestWithdraw(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
            'payoutDetails' => ['nullable', 'array'],
        ]);

        $payoutDetails = $data['payoutDetails'] ?? [];
        if (!is_array($payoutDetails)) {
            $payoutDetails = [];
        }

        $amount = round((float) $data['amount'], 2);
        $fee = self::WITHDRAW_FEE_AMOUNT;
        $totalDebit = $amount + $fee;
        $phone = trim((string) ($payoutDetails['phone'] ?? $user->phone ?? ''));
        $country = strtoupper(trim((string) ($payoutDetails['country'] ?? $user->country_code ?? 'CI')));
        $method = trim((string) ($payoutDetails['method'] ?? 'mobile_money'));
        $beneficiaryName = trim((string) ($payoutDetails['name'] ?? ''));

        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if ($digits === '' || strlen($digits) < 6) {
            throw ValidationException::withMessages([
                'payoutDetails.phone' => ['Numéro de retrait invalide.'],
            ]);
        }

        if (strlen($country) !== 2) {
            throw ValidationException::withMessages([
                'payoutDetails.country' => ['Code pays invalide.'],
            ]);
        }

        $result = DB::transaction(function () use ($user, $amount, $fee, $totalDebit, $digits, $country, $method, $beneficiaryName, $payoutDetails) {
            /** @var WalletAccount $wallet */
            $wallet = WalletAccount::query()
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first();

            if (!$wallet) {
                $wallet = $this->walletService->getOrCreateWallet($user);
                $wallet = WalletAccount::query()
                    ->where('id', $wallet->id)
                    ->lockForUpdate()
                    ->firstOrFail();
            }

            if ((string) ($wallet->status ?? '') === 'locked') {
                throw ValidationException::withMessages([
                    'wallet' => ['Wallet verrouillé.'],
                ]);
            }

            if ((float) ($wallet->balance ?? 0) + 0.0001 < $totalDebit) {
                throw ValidationException::withMessages([
                    'amount' => ['Solde insuffisant pour couvrir le montant et les frais de retrait.'],
                ]);
            }

            $idempotencyKey = 'PAYOUT-' . strtoupper(Str::random(12));

            $payout = Payout::create([
                'user_id' => $user->id,
                'wallet_account_id' => $wallet->id,
                'amount' => $amount,
                'fee' => $fee,
                'total_debit' => $totalDebit,
                'currency' => (string) ($wallet->currency ?: 'FCFA'),
                'country' => $country,
                'phone' => $digits,
                'provider' => 'MONEROO',
                'status' => 'queued',
                'idempotency_key' => $idempotencyKey,
            ]);

            $this->walletService->debitHold($user, $idempotencyKey, $totalDebit, [
                'type' => 'wallet_withdrawal',
                'reason' => 'wallet_withdrawal',
                'payout_id' => $payout->id,
                'withdraw_fee_amount' => $fee,
                'withdraw_total_debit' => $totalDebit,
                'withdraw_net_amount' => $amount,
                'payout_method' => $method,
                'beneficiary_phone' => $digits,
                'beneficiary_country' => $country,
                'beneficiary_name' => $beneficiaryName !== '' ? $beneficiaryName : null,
                'payout_details' => $payoutDetails,
            ]);

            return [
                'wallet' => $wallet->fresh(),
                'payout' => $payout->fresh(),
            ];
        });

        ProcessPayout::dispatchSync($result['payout']->id);

        $result['payout'] = Payout::query()->findOrFail($result['payout']->id);

        return response()->json([
            'success' => true,
            'message' => 'Demande de retrait envoyée.',
            'data' => [
                'wallet_balance' => (float) $result['wallet']->balance,
                'withdraw_fee_amount' => $fee,
                'payout' => $this->mapPayout($result['payout']),
            ],
        ], 201);
    }

    private function mapPayout(Payout $payout): array
    {
        return [
            'id' => $payout->id,
            'amount' => (float) $payout->amount,
            'fee' => (float) $payout->fee,
            'total_debit' => (float) $payout->total_debit,
            'currency' => $payout->currency,
            'country' => $payout->country,
            'phone' => $payout->phone,
            'provider' => $payout->provider,
            'provider_ref' => $payout->provider_ref,
            'status' => $payout->status,
            'failure_reason' => $payout->failure_reason,
            'created_at' => optional($payout->created_at)->toIso8601String(),
        ];
    }

    private function syncPendingPayouts(WalletAccount $wallet): void
    {
        $pendingIds = $wallet->payouts()
            ->whereIn('status', ['queued', 'processing'])
            ->latest('created_at')
            ->limit(3)
            ->pluck('id');

        if ($pendingIds->isEmpty()) {
            return;
        }

        $throttleKey = 'wallet:payout-sync:' . $wallet->id;
        if (!Cache::add($throttleKey, now()->toIso8601String(), now()->addSeconds(30))) {
            return;
        }

        foreach ($pendingIds as $pendingId) {
            try {
                ProcessPayout::dispatch((string) $pendingId)->afterResponse();
            } catch (\Throwable) {
                // best effort sync on read
            }
        }
    }

    private function findReusablePendingTopup(User $user, float $amount): ?array
    {
        $payment = Payment::query()
            ->with(['order', 'walletTransaction'])
            ->where('method', 'moneroo')
            ->where('status', 'pending')
            ->where('amount', $amount)
            ->where('created_at', '>=', now()->subMinutes(15))
            ->whereHas('order', function ($query) use ($user) {
                $query->where('user_id', $user->id)
                    ->where('type', 'wallet_topup')
                    ->whereIn('status', [Order::STATUS_PAYMENT_PROCESSING, Order::STATUS_AWAITING_PAYMENT]);
            })
            ->latest('created_at')
            ->first();

        if (!$payment || !$payment->order || !$payment->walletTransaction) {
            return null;
        }

        $paymentUrl = trim((string) Arr::get($payment->webhook_data, 'init_response.checkout_url', ''));
        if ($paymentUrl === '') {
            return null;
        }

        return [
            'payment_url' => $paymentUrl,
            'transaction_id' => (string) ($payment->transaction_id ?? ''),
            'payment_id' => $payment->id,
            'order_id' => $payment->order_id,
            'wallet_transaction_id' => $payment->wallet_transaction_id,
            'amount' => (float) $payment->amount,
            'currency' => 'XOF',
            'provider_currency' => (string) (Arr::get($payment->webhook_data, 'provider_currency', 'XOF')),
            'provider_amount' => (float) (Arr::get($payment->webhook_data, 'provider_amount', $payment->amount)),
            'provider' => 'moneroo',
            'status' => 'pending',
        ];
    }

    private function mapTopupFailureMessage(\Throwable $e): string
    {
        $message = trim((string) $e->getMessage());

        return match (true) {
            $message === '' => 'Impossible de démarrer la recharge wallet.',
            str_contains($message, 'Moneroo not configured') => 'Le paiement Moneroo n\'est pas encore configuré sur le serveur.',
            str_contains($message, 'Moneroo return URL is not configured') => 'L\'URL de retour Moneroo est absente sur le serveur.',
            str_contains($message, 'Moneroo requires a customer email address') => 'Ajoute une adresse email à ton compte avant de recharger le wallet.',
            str_contains($message, 'customer.last name') => 'Le nom du client est incomplet pour initier le paiement.',
            str_contains($message, 'too many requests') => 'Le service de paiement est temporairement saturé. Réessaie dans un instant.',
            default => 'Impossible de démarrer la recharge wallet.',
        };
    }

    private function findRecipient(string $query, int $senderId): ?User
    {
        $raw = trim($query);
        if ($raw === '') {
            return null;
        }

        $normalizedPhone = preg_replace('/\D+/', '', $raw) ?? '';
        $normalizedName = strtoupper($raw);
        $normalizedWalletId = strtoupper($raw);

        $user = User::query()
            ->where('id', '!=', $senderId)
            ->whereHas('walletAccount', function ($walletQuery) use ($normalizedWalletId) {
                $walletQuery->whereRaw('UPPER(wallet_id) = ?', [$normalizedWalletId]);
            })
            ->first();

        if ($user) {
            return $user;
        }

        $user = User::query()
            ->where('id', '!=', $senderId)
            ->whereRaw('UPPER(name) = ?', [$normalizedName])
            ->first();

        if ($user) {
            return $user;
        }

        if ($normalizedPhone === '' || strlen($normalizedPhone) < 6) {
            return null;
        }

        $matches = User::query()
            ->where('id', '!=', $senderId)
            ->where('phone', $normalizedPhone)
            ->limit(2)
            ->get();

        if ($matches->count() !== 1) {
            return null;
        }

        return $matches->first();
    }

    private function mapRecipient(User $recipient, WalletAccount $wallet): array
    {
        return [
            'id' => $recipient->id,
            'username' => $recipient->name,
            'wallet_id' => $wallet->wallet_id,
            'phone_masked' => $this->maskPhone((string) ($recipient->phone ?? '')),
        ];
    }

    private function maskPhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (strlen($digits) <= 4) {
            return $digits;
        }

        return str_repeat('*', max(0, strlen($digits) - 4)) . substr($digits, -4);
    }
}
