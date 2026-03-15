<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessFedaPayPayoutWebhook;
use App\Mail\TemplatedNotification;
use App\Models\PartnerWallet;
use App\Models\PartnerWithdrawRequest;
use App\Services\AdminAuditLogger;
use App\Services\FedaPayService;
use App\Services\LoggedEmailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminMarketplaceWithdrawController extends Controller
{
    private function frontendUrl(string $path = ''): string
    {
        $base = rtrim((string) (env('FRONTEND_URL', config('app.url'))), '/');
        $p = '/' . ltrim($path, '/');
        return $base . ($path !== '' ? $p : '');
    }
    public function index(Request $request)
    {
        $q = PartnerWithdrawRequest::query()->with(['seller.user', 'partnerWallet']);

        if ($request->filled('status')) {
            $q->where('status', $request->string('status')->toString());
        }

        if ($request->filled('provider_status')) {
            $q->withFedapayStatus(trim((string) $request->query('provider_status')));
        }

        $withdraws = $q->orderByDesc('created_at')->paginate(30);

        return response()->json(['data' => $withdraws]);
    }

    public function markPaid(Request $request, PartnerWithdrawRequest $partnerWithdrawRequest, FedaPayService $fedaPayService)
    {
        $admin = $request->user();

        if ($partnerWithdrawRequest->status !== 'requested') {
            throw ValidationException::withMessages([
                'status' => ['Withdraw request is not in requested status.'],
            ]);
        }

        $data = $request->validate([
            'adminNote' => ['nullable', 'string', 'max:2000'],
        ]);

        $syncPayload = DB::transaction(function () use ($partnerWithdrawRequest, $admin, $data, $fedaPayService) {
            $wallet = PartnerWallet::query()->where('id', $partnerWithdrawRequest->partner_wallet_id)->lockForUpdate()->firstOrFail();
            $partnerWithdrawRequest = PartnerWithdrawRequest::query()
                ->with(['seller.user', 'partnerWallet'])
                ->whereKey($partnerWithdrawRequest->id)
                ->lockForUpdate()
                ->firstOrFail();

            $amount = (float) $partnerWithdrawRequest->amount;
            $payout = $partnerWithdrawRequest->payout_details;
            if (!is_array($payout)) {
                $payout = [];
            }

            $feeAmount = (float) ($payout['withdraw_fee_amount'] ?? 0);
            $totalDebit = (float) ($payout['withdraw_total_debit'] ?? ($amount + $feeAmount));
            if ($totalDebit <= 0) {
                $totalDebit = $amount;
            }

            if ($totalDebit > (float) $wallet->reserved_withdraw_balance) {
                throw ValidationException::withMessages([
                    'amount' => ['Reserved balance is insufficient.'],
                ]);
            }

            $user = $partnerWithdrawRequest->seller?->user;
            if (!$user) {
                throw ValidationException::withMessages([
                    'seller' => ['Seller user not found.'],
                ]);
            }

            $providerStatus = strtolower((string) ($payout['provider_status'] ?? ''));
            if (in_array($providerStatus, ['processing', 'sent'], true)) {
                $partnerWithdrawRequest->processed_by_admin_id = $admin->id;
                $partnerWithdrawRequest->admin_note = $data['adminNote'] ?? $partnerWithdrawRequest->admin_note;
                $partnerWithdrawRequest->save();
                return null;
            }

            $phone = trim((string) ($payout['phone'] ?? ''));
            if ($phone === '') {
                throw ValidationException::withMessages([
                    'phone' => ['Seller withdraw phone is missing.'],
                ]);
            }

            $country = strtoupper(trim((string) ($payout['country'] ?? ($user->country_code ?? 'CI'))));
            $name = trim((string) ($payout['name'] ?? $user->name ?? ''));

            $created = $fedaPayService->createPayout($user, [
                'amount' => $amount,
                'currency' => 'XOF',
                'mode' => 'mobile_money',
                'customer_phone' => $phone,
                'customer_country' => $country,
                'customer_name' => $name,
                'customer_email' => $user->email,
                'merchant_reference' => 'PARTNER-WDR-' . $partnerWithdrawRequest->id,
                'metadata' => [
                    'source' => 'partner_withdraw_request',
                    'partner_withdraw_request_id' => $partnerWithdrawRequest->id,
                    'seller_id' => $partnerWithdrawRequest->seller_id,
                ],
                'custom_metadata' => [
                    'partner_withdraw_request_id' => $partnerWithdrawRequest->id,
                    'seller_id' => $partnerWithdrawRequest->seller_id,
                    'admin_id' => $admin->id,
                ],
            ]);

            $providerId = $fedaPayService->extractPayoutId($created);
            $started = null;
            if ($providerId) {
                $started = $fedaPayService->startPayout([
                    [
                        'id' => $providerId,
                        'phone_number' => [
                            'number' => preg_replace('/\D+/', '', $phone) ?? $phone,
                            'country' => $country,
                        ],
                    ],
                ]);
            }

            $currentPayload = is_array($started) ? $started : $created;
            $providerStatus = $fedaPayService->normalizePayoutStatus($currentPayload);

            $partnerWithdrawRequest->processed_by_admin_id = $admin->id;
            $partnerWithdrawRequest->admin_note = $data['adminNote'] ?? null;
            $partnerWithdrawRequest->payout_details = array_merge($payout, [
                'provider' => 'fedapay',
                'provider_payout_id' => $providerId,
                'provider_reference' => $fedaPayService->extractPayoutReference($created),
                'provider_status' => $providerStatus,
                'provider_payload' => $created,
                'provider_start_payload' => $started,
            ]);
            $partnerWithdrawRequest->save();

            return [
                'entity' => is_array($currentPayload) && array_is_list($currentPayload)
                    ? ($currentPayload[0] ?? $created)
                    : $currentPayload,
            ];
        });

        if (is_array($syncPayload)) {
            ProcessFedaPayPayoutWebhook::dispatchSync($syncPayload);
        }

        $partnerWithdrawRequest->load(['seller.user', 'partnerWallet']);

        try {
            /** @var AdminAuditLogger $audit */
            $audit = app(AdminAuditLogger::class);
            $audit->log($admin, 'marketplace.withdraw.mark_paid', [
                'withdraw_request_id' => $partnerWithdrawRequest->id,
                'seller_id' => $partnerWithdrawRequest->seller_id,
                'amount' => (float) $partnerWithdrawRequest->amount,
                'provider_status' => $partnerWithdrawRequest->payout_details['provider_status'] ?? null,
            ], 'marketplace', $request);
        } catch (\Throwable $e) {
        }

        return response()->json([
            'ok' => true,
            'withdrawRequest' => $partnerWithdrawRequest,
        ]);
    }

    public function reject(Request $request, PartnerWithdrawRequest $partnerWithdrawRequest)
    {
        $admin = $request->user();

        if ($partnerWithdrawRequest->status !== 'requested') {
            throw ValidationException::withMessages([
                'status' => ['Withdraw request is not in requested status.'],
            ]);
        }

        $data = $request->validate([
            'adminNote' => ['required', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($partnerWithdrawRequest, $admin, $data) {
            $wallet = PartnerWallet::query()->where('id', $partnerWithdrawRequest->partner_wallet_id)->lockForUpdate()->firstOrFail();

            $amount = (float) $partnerWithdrawRequest->amount;
            $payout = $partnerWithdrawRequest->payout_details;
            if (!is_array($payout)) {
                $payout = [];
            }

            $feeAmount = (float) ($payout['withdraw_fee_amount'] ?? 0);
            $totalDebit = (float) ($payout['withdraw_total_debit'] ?? ($amount + $feeAmount));
            if ($totalDebit <= 0) {
                $totalDebit = $amount;
            }

            if ($totalDebit > (float) $wallet->reserved_withdraw_balance) {
                throw ValidationException::withMessages([
                    'amount' => ['Reserved balance is insufficient.'],
                ]);
            }

            $wallet->reserved_withdraw_balance = (float) $wallet->reserved_withdraw_balance - $totalDebit;
            $wallet->available_balance = (float) $wallet->available_balance + $totalDebit;
            $wallet->save();

            $partnerWithdrawRequest->status = 'rejected';
            $partnerWithdrawRequest->processed_by_admin_id = $admin->id;
            $partnerWithdrawRequest->processed_at = now();
            $partnerWithdrawRequest->admin_note = $data['adminNote'];
            $partnerWithdrawRequest->save();
        });

        $partnerWithdrawRequest->load(['seller.user', 'partnerWallet']);

        // Email seller (best-effort)
        try {
            $user = $partnerWithdrawRequest->seller?->user;
            if ($user && $user->email) {
                $subject = 'Retrait refusé - DB Partner';
                $reason = (string) ($data['adminNote'] ?? $partnerWithdrawRequest->admin_note ?? '');
                $amount = (float) ($partnerWithdrawRequest->amount ?? 0);

                $mailable = new TemplatedNotification(
                    'partner_withdraw_rejected',
                    $subject,
                    [
                        'withdraw' => $partnerWithdrawRequest->toArray(),
                        'user' => $user->toArray(),
                        'reason' => $reason,
                    ],
                    [
                        'title' => $subject,
                        'headline' => 'Retrait refusé',
                        'intro' => 'Ta demande de retrait a été refusée par l’admin.',
                        'details' => [
                            ['label' => 'Montant', 'value' => number_format($amount, 0, ',', ' ') . ' FCFA'],
                            ['label' => 'Motif', 'value' => $reason ?: '—'],
                        ],
                        'actionUrl' => $this->frontendUrl('/account/seller'),
                        'actionText' => 'Voir mes retraits',
                    ]
                );

                /** @var LoggedEmailService $logged */
                $logged = app(LoggedEmailService::class);
                $logged->queue($user->id, $user->email, 'partner_withdraw_rejected', $subject, $mailable, [
                    'withdraw_request_id' => $partnerWithdrawRequest->id,
                ]);
            }
        } catch (\Throwable $e) {
        }

        try {
            /** @var AdminAuditLogger $audit */
            $audit = app(AdminAuditLogger::class);
            $audit->log($admin, 'marketplace.withdraw.reject', [
                'withdraw_request_id' => $partnerWithdrawRequest->id,
                'seller_id' => $partnerWithdrawRequest->seller_id,
                'amount' => (float) $partnerWithdrawRequest->amount,
                'note' => $data['adminNote'],
            ], 'marketplace', $request);
        } catch (\Throwable $e) {
        }

        return response()->json(['ok' => true]);
    }
}
