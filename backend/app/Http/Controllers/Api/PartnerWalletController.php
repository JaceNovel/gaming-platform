<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\TemplatedNotification;
use App\Models\PartnerWallet;
use App\Models\PartnerWithdrawRequest;
use App\Models\Seller;
use App\Services\AdminResponsibilityService;
use App\Services\FedaPayService;
use App\Services\LoggedEmailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PartnerWalletController extends Controller
{
    private const WITHDRAW_FEE_AMOUNT = 1000.0;

    public function __construct(private FedaPayService $fedaPayService)
    {
    }

    private function frontendUrl(string $path = ''): string
    {
        $base = rtrim((string) (env('FRONTEND_URL', config('app.url'))), '/');
        $p = '/' . ltrim($path, '/');
        return $base . ($path !== '' ? $p : '');
    }

    public function show(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }
        $seller = Seller::query()->where('user_id', $user->id)->first();

        if (!$seller) {
            return response()->json(['partnerWallet' => null, 'withdrawRequests' => []]);
        }

        $wallet = PartnerWallet::query()->where('seller_id', $seller->id)->first();

        $withdrawRequests = PartnerWithdrawRequest::query()
            ->where('seller_id', $seller->id)
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

        return response()->json([
            'sellerStatus' => $seller->status,
            'partnerWalletFrozen' => (bool) $seller->partner_wallet_frozen,
            'partnerWallet' => $wallet,
            'withdrawRequests' => $withdrawRequests,
            'payout_support' => $this->fedaPayService->payoutSupport(),
        ]);
    }

    public function requestWithdraw(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }
        $seller = Seller::query()->where('user_id', $user->id)->firstOrFail();

        if ($seller->status !== 'approved') {
            throw ValidationException::withMessages([
                'seller' => ['Seller is not approved.'],
            ]);
        }

        if ($seller->partner_wallet_frozen) {
            return response()->json(['message' => 'Partner wallet is frozen.'], 403);
        }

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
            'payoutDetails' => ['nullable', 'array'],
        ]);

        /** @var PartnerWithdrawRequest $withdraw */
        $withdraw = DB::transaction(function () use ($seller, $data) {
            $wallet = PartnerWallet::query()
                ->where('seller_id', $seller->id)
                ->lockForUpdate()
                ->first();

            if (!$wallet) {
                throw ValidationException::withMessages([
                    'partnerWallet' => ['Partner wallet not found.'],
                ]);
            }

            if ($wallet->status === 'frozen') {
                throw ValidationException::withMessages([
                    'partnerWallet' => ['Partner wallet is frozen.'],
                ]);
            }

            $amount = (float) $data['amount'];
            $fee = self::WITHDRAW_FEE_AMOUNT;
            $totalDebit = $amount + $fee;

            if ($totalDebit > (float) $wallet->available_balance) {
                throw ValidationException::withMessages([
                    'amount' => ['Insufficient available balance (withdraw amount + fee).'],
                ]);
            }

            $wallet->available_balance = (float) $wallet->available_balance - $totalDebit;
            $wallet->reserved_withdraw_balance = (float) $wallet->reserved_withdraw_balance + $totalDebit;
            $wallet->save();

            $payoutDetails = $data['payoutDetails'] ?? null;
            if (!is_array($payoutDetails)) {
                $payoutDetails = null;
            }

            // Store fee information for admin processing (backward compatible with older rows).
            $payoutDetailsWithFee = array_merge($payoutDetails ?? [], [
                'withdraw_fee_amount' => $fee,
                'withdraw_total_debit' => $totalDebit,
                'withdraw_net_amount' => $amount,
            ]);

            return PartnerWithdrawRequest::create([
                'partner_wallet_id' => $wallet->id,
                'seller_id' => $seller->id,
                'amount' => $amount,
                'status' => 'requested',
                'payout_details' => $payoutDetailsWithFee,
            ]);
        });

        // Email seller (best-effort)
        try {
            $seller->loadMissing('user');
            $user = $seller->user;
            if ($user && $user->email) {
                $amount = (float) ($withdraw->amount ?? 0);
                $payout = is_array($withdraw->payout_details) ? $withdraw->payout_details : [];
                $fee = (float) ($payout['withdraw_fee_amount'] ?? 0);
                $total = (float) ($payout['withdraw_total_debit'] ?? ($amount + $fee));

                $subject = 'Demande de retrait reçue - PRIME Gaming';
                $mailable = new TemplatedNotification(
                    'partner_withdraw_requested',
                    $subject,
                    [
                        'withdraw' => $withdraw->toArray(),
                        'seller' => $seller->toArray(),
                        'user' => $user->toArray(),
                    ],
                    [
                        'title' => $subject,
                        'headline' => 'Retrait demandé',
                        'intro' => 'Ta demande de retrait a été enregistrée et sera traitée par l’admin.',
                        'details' => [
                            ['label' => 'Montant', 'value' => number_format($amount, 0, ',', ' ') . ' FCFA'],
                            ['label' => 'Frais', 'value' => number_format($fee, 0, ',', ' ') . ' FCFA'],
                            ['label' => 'Total débité', 'value' => number_format($total, 0, ',', ' ') . ' FCFA'],
                        ],
                        'actionUrl' => $this->frontendUrl('/account/seller'),
                        'actionText' => 'Voir mes retraits',
                    ]
                );

                /** @var LoggedEmailService $logged */
                $logged = app(LoggedEmailService::class);
                $logged->queue($user->id, $user->email, 'partner_withdraw_requested', $subject, $mailable, [
                    'withdraw_request_id' => $withdraw->id,
                ]);
            }
        } catch (\Throwable $e) {
        }

        try {
            $amount = (float) ($withdraw->amount ?? 0);
            $payout = is_array($withdraw->payout_details) ? $withdraw->payout_details : [];
            $fee = (float) ($payout['withdraw_fee_amount'] ?? 0);
            $total = (float) ($payout['withdraw_total_debit'] ?? ($amount + $fee));

            app(AdminResponsibilityService::class)->notify(
                'sellers',
                'admin_partner_withdraw_requested',
                'Nouveau retrait vendeur en attente',
                [
                    'headline' => 'Retrait vendeur a traiter',
                    'intro' => 'Un vendeur vient d\'envoyer une demande de retrait marketplace.',
                    'details' => [
                        ['label' => 'Vendeur', 'value' => (string) ($seller->company_name ?? $seller->kyc_full_name ?? $user->name ?? 'Vendeur')],
                        ['label' => 'Email', 'value' => (string) ($user->email ?? '—')],
                        ['label' => 'Montant net', 'value' => number_format($amount, 0, ',', ' ') . ' FCFA'],
                        ['label' => 'Frais', 'value' => number_format($fee, 0, ',', ' ') . ' FCFA'],
                        ['label' => 'Total debite', 'value' => number_format($total, 0, ',', ' ') . ' FCFA'],
                    ],
                    'actionUrl' => $this->frontendUrl('/admin/marketplace/withdraws'),
                    'actionText' => 'Voir les retraits vendeur',
                ],
                [
                    'withdraw' => $withdraw->toArray(),
                    'seller' => $seller->toArray(),
                    'user' => $user->toArray(),
                ],
                [
                    'withdraw_request_id' => $withdraw->id,
                    'seller_id' => $seller->id,
                ]
            );
        } catch (\Throwable $e) {
        }

        return response()->json(['ok' => true, 'withdrawRequest' => $withdraw], 201);
    }
}
