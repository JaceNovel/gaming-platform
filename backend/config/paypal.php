<?php

$appUrl = rtrim(env('APP_URL', ''), '/');
$frontUrl = rtrim(env('FRONTEND_URL', $appUrl), '/');

return [
    'client_id' => env('PAYPAL_CLIENT_ID'),
    'client_secret' => env('PAYPAL_CLIENT_SECRET'),
    'environment' => env('PAYPAL_ENV', 'sandbox'),
    'base_url' => rtrim(env('PAYPAL_BASE_URL', ''), '/'),
    'timeout' => (int) env('PAYPAL_TIMEOUT', 15),
    'default_currency' => env('PAYPAL_DEFAULT_CURRENCY', 'EUR'),
    'xof_to_eur_rate' => (float) env('PAYPAL_XOF_TO_EUR_RATE', 655.957),
    'webhook_id' => env('PAYPAL_WEBHOOK_ID'),
    'return_url' => env('PAYPAL_RETURN_URL', $appUrl ? $appUrl . '/api/payments/paypal/return' : null),
    'cancel_url' => env('PAYPAL_CANCEL_URL', $appUrl ? $appUrl . '/api/payments/paypal/return?cancelled=1' : null),
    'frontend_status_url' => env('PAYPAL_FRONTEND_STATUS_URL', $frontUrl ? $frontUrl . '/order-confirmation' : null),
];