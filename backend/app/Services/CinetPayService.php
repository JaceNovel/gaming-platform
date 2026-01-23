<?php

namespace App\Services;

use App\Models\Payment;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class CinetPayService
{
    protected $apiKey;
    protected $siteId;
    protected $secret;
    protected $baseUrl;
    protected $webhookSecret;

    public function __construct()
    {
        $this->apiKey = config('services.cinetpay.api_key');
        $this->siteId = config('services.cinetpay.site_id');
        $this->secret = config('services.cinetpay.secret');
        $this->webhookSecret = config('services.cinetpay.webhook_secret');
        $this->baseUrl = rtrim(config('services.cinetpay.base_url', 'https://client.cinetpay.com/v1'), '/') . '/';
    }

    public function initiatePayment(Payment $payment, array $options = []): string
    {
        $notifyUrl = $options['notify_url'] ?? route('api.payments.cinetpay.webhook');
        $description = $options['description'] ?? ('BADBOYSHOP Order #' . ($payment->order->id ?? ''));
        $returnUrl = $options['return_url'] ?? (config('app.url') . '/payment/success');
        $cancelUrl = $options['cancel_url'] ?? (config('app.url') . '/payment/cancel');
        $currency = $options['currency'] ?? 'XAF';
        $channels = $options['channels'] ?? 'MOBILE_MONEY';

        $payload = [
            'apikey' => $this->apiKey,
            'site_id' => $this->siteId,
            'transaction_id' => $payment->id . '_' . Str::random(8),
            'amount' => $payment->amount,
            'currency' => $currency,
            'description' => $description,
            'customer_name' => $payment->order->user->name,
            'customer_email' => $payment->order->user->email,
            'customer_phone_number' => '', // Optional
            'notify_url' => $notifyUrl,
            'return_url' => $returnUrl,
            'cancel_url' => $cancelUrl,
            'channels' => $channels,
            'lang' => 'fr',
        ];

        $response = Http::post($this->baseUrl . 'payment', $payload);

        if ($response->successful()) {
            $data = $response->json();

            if ($data['code'] === '201') {
                // Update payment with transaction_id
                $payment->update([
                    'transaction_id' => $payload['transaction_id'],
                ]);

                return $data['data']['payment_url'];
            } else {
                throw new \Exception('CinetPay API error: ' . $data['message']);
            }
        } else {
            throw new \Exception('CinetPay API request failed: ' . $response->body());
        }
    }

    public function validateWebhook(array $data): bool
    {
        // CinetPay typically uses HMAC signature
        // This is a simplified version - adjust based on actual CinetPay webhook format

        if (!isset($data['signature'])) {
            return false;
        }

        // Create signature from relevant fields
        $signatureData = [
            'cpm_trans_id' => $data['cpm_trans_id'] ?? '',
            'cpm_amount' => $data['cpm_amount'] ?? '',
            'cpm_currency' => $data['cpm_currency'] ?? '',
            'cpm_trans_status' => $data['cpm_trans_status'] ?? '',
        ];

        $signatureString = implode('', array_values($signatureData));
        $expectedSignature = hash_hmac('sha256', $signatureString, $this->webhookSecret);

        return hash_equals($expectedSignature, $data['signature']);
    }

    public function checkPaymentStatus(string $transactionId): array
    {
        $payload = [
            'apikey' => $this->apiKey,
            'site_id' => $this->siteId,
            'transaction_id' => $transactionId,
        ];

        $response = Http::post($this->baseUrl . 'payment/check', $payload);

        if ($response->successful()) {
            return $response->json();
        }

        throw new \Exception('Failed to check payment status');
    }
}