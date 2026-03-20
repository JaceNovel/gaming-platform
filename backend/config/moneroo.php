<?php

$appUrl = rtrim((string) env('APP_URL', ''), '/');
$frontUrl = rtrim((string) env('FRONTEND_URL', ''), '/');

return [
    'public_key' => env('MONEROO_PUBLIC_KEY'),
    'secret_key' => env('MONEROO_SECRET_KEY'),
    'webhook_secret' => env('MONEROO_WEBHOOK_SECRET'),
    'base_url' => rtrim((string) env('MONEROO_BASE_URL', 'https://api.moneroo.io/v1'), '/'),
    'timeout' => (int) env('MONEROO_TIMEOUT', 30),
    'default_currency' => strtoupper((string) env('MONEROO_DEFAULT_CURRENCY', 'XOF')),
    'return_url' => env('MONEROO_RETURN_URL', $appUrl !== '' ? $appUrl . '/api/payments/moneroo/return' : null),
    'frontend_status_url' => env('MONEROO_FRONTEND_STATUS_URL', $frontUrl !== '' ? $frontUrl . '/checkout/status' : null),
    'payout_return_url' => env('MONEROO_PAYOUT_RETURN_URL', $frontUrl !== '' ? $frontUrl . '/wallet' : null),
    'enabled' => (bool) env('MONEROO_ENABLED', true),
];