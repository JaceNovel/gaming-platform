<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_values(array_filter([
        env('FRONTEND_URL'),
        env('APP_URL'),
        env('NEXT_PUBLIC_APP_URL'),
        env('VERCEL_URL') ? 'https://' . env('VERCEL_URL') : null,
        'https://badboyshop.online',
        'http://localhost:3000',
    ])),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => (bool) env('CORS_SUPPORTS_CREDENTIALS', true),
];
