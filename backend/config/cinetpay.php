<?php

$appUrl = rtrim(env('APP_URL', ''), '/');
$frontUrl = rtrim(env('FRONTEND_URL', $appUrl), '/');

return [
    'api_key' => env('CINETPAY_API_KEY'),
    'site_id' => env('CINETPAY_SITE_ID'),
    'secret' => env('CINETPAY_SECRET'),
    'webhook_secret' => env('CINETPAY_WEBHOOK_SECRET', env('CINETPAY_SECRET')),
    'transfer_webhook_secret' => env('CINETPAY_TRANSFER_WEBHOOK_SECRET', env('CINETPAY_SECRET')),
    'base_url' => rtrim(env('CINETPAY_BASE_URL', 'https://api-checkout.cinetpay.com/v2'), '/'),
    'transfer_base_url' => env('CINETPAY_TRANSFER_BASE_URL'),
    'timeout' => (int) env('CINETPAY_TIMEOUT', 15),
    'default_currency' => env('CINETPAY_DEFAULT_CURRENCY', 'XOF'),
    'default_channels' => env('CINETPAY_CHANNELS', 'MOBILE_MONEY'),
    'return_url' => env('CINETPAY_RETURN_URL', $appUrl ? $appUrl . '/api/payments/cinetpay/return' : null),
    'cancel_url' => env('CINETPAY_CANCEL_URL', $frontUrl ? $frontUrl . '/checkout/cancel' : null),
    'frontend_status_url' => env('CINETPAY_FRONTEND_STATUS_URL', $frontUrl ? $frontUrl . '/checkout/status' : null),
];
