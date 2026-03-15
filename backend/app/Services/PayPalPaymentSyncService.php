<?php

namespace App\Services;

use App\Models\Payment;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class PayPalPaymentSyncService
{
    public function __construct(
        private PayPalService $payPalService,
        private PaymentSettlementService $paymentSettlementService,
    ) {
    }

    public function sync(Payment $payment, bool $captureIfApproved, array $context = []): string
    {
        if (!$payment->transaction_id) {
            throw new \RuntimeException('Missing PayPal order id');
        }

        $providerOrder = $this->payPalService->showOrder((string) $payment->transaction_id);
        $normalized = $this->payPalService->normalizeOrderStatus($providerOrder);
        $captureId = $this->payPalService->extractCaptureId($providerOrder) ?? '';

        if ($normalized === 'approved' && $captureIfApproved) {
            try {
                $providerOrder = $this->payPalService->captureOrder(
                    (string) $payment->transaction_id,
                    'paypal-capture-' . $payment->id . '-' . Str::uuid()->toString(),
                );
                $normalized = $this->payPalService->normalizeOrderStatus($providerOrder);
                $captureId = $this->payPalService->extractCaptureId($providerOrder) ?? '';
            } catch (\Throwable $e) {
                $providerOrder = $this->payPalService->showOrder((string) $payment->transaction_id);
                $normalized = $this->payPalService->normalizeOrderStatus($providerOrder);
                $captureId = $this->payPalService->extractCaptureId($providerOrder) ?? '';

                if ($normalized !== 'completed') {
                    throw $e;
                }
            }
        }

        if (in_array($normalized, ['completed', 'failed'], true)) {
            $attemptCurrency = strtoupper((string) Arr::get($providerOrder, 'purchase_units.0.amount.currency_code', config('paypal.default_currency', 'EUR')));

            $this->paymentSettlementService->settle($payment, $normalized, [
                'provider' => 'paypal',
                'provider_transaction_id' => (string) $payment->transaction_id,
                'provider_payload' => $providerOrder,
                'capture_id' => $captureId,
                'attempt_currency' => $attemptCurrency,
                'context' => $context,
            ]);
        }

        return $normalized;
    }
}