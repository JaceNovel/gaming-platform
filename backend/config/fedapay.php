<?php

$appUrl = rtrim(env('APP_URL', ''), '/');
$frontUrl = rtrim(env('FRONTEND_URL', $appUrl), '/');

$defaultCallback = $frontUrl ? $frontUrl . '/order-confirmation' : null;
$payoutCurrencyIds = json_decode((string) env('FEDAPAY_CURRENCY_IDS', '{}'), true);
$payoutBalanceIds = json_decode((string) env('FEDAPAY_PAYOUT_BALANCE_IDS', '{}'), true);

if (!is_array($payoutCurrencyIds)) {
    $payoutCurrencyIds = [];
}

if (!is_array($payoutBalanceIds)) {
    $payoutBalanceIds = [];
}

return [
    // Secret key is required server-side. Never expose it to the frontend.
    'secret_key' => env('FEDAPAY_SECRET_KEY'),

    // 'sandbox' or 'live'
    'environment' => env('FEDAPAY_ENV', 'sandbox'),

    // If you need to override (rare), provide a full base URL.
    'base_url' => rtrim(env('FEDAPAY_BASE_URL', ''), '/'),

    'timeout' => (int) env('FEDAPAY_TIMEOUT', 15),

    'default_currency' => env('FEDAPAY_DEFAULT_CURRENCY', 'XOF'),

    // Where FedaPay redirects the user after payment.
    // FedaPay will append ?id=...&status=...; frontend must still verify via API.
    'callback_url' => env('FEDAPAY_CALLBACK_URL', $defaultCallback),

    // Webhook endpoint secret (from FedaPay dashboard webhook settings).
    // Different per endpoint and per environment (test/live).
    'webhook_secret' => env('FEDAPAY_WEBHOOK_SECRET'),

    // Max age in seconds for webhook timestamp (replay protection).
    'webhook_tolerance' => (int) env('FEDAPAY_WEBHOOK_TOLERANCE', 300),

    // Optional explicit FedaPay currency IDs keyed by ISO, e.g. {"XOF":1}
    'currency_ids' => $payoutCurrencyIds,

    // Optional explicit source balance IDs keyed by FedaPay payout mode, e.g. {"togocel":1270186}
    'payout_balance_ids' => $payoutBalanceIds,
];
