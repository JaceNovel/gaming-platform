<?php

return [
    // Master toggle to enable sending SMS.
    // Keep disabled by default to avoid sending SMS in dev/staging.
    'enabled' => (bool) env('NGH_SMS_ENABLED', false),

    // Base URL for NGH endpoints.
    // Docs: https://extranet.nghcorp.net/api/send-sms
    'base_url' => env('NGH_SMS_BASE_URL', 'https://extranet.nghcorp.net/api'),

    // Credentials (DO NOT hardcode; set in Render environment).
    'api_key' => env('NGH_SMS_API_KEY', ''),
    'api_secret' => env('NGH_SMS_API_SECRET', ''),

    // Default sender id.
    'from' => env('NGH_SMS_FROM', env('APP_NAME', 'PRIME Gaming')),

    'timeout' => (int) env('NGH_SMS_TIMEOUT', 15),
];
