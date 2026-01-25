<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_values(array_filter([
        'https://badboyshop.online',
        'https://www.badboyshop.online',
        env('FRONTEND_URL'),
        env('FRONTEND_URL_WWW'),
        env('NEXT_PUBLIC_APP_URL'),
        env('APP_ENV') === 'local' ? 'http://localhost:3000' : null,
    ])),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => ['Authorization'],
    'max_age' => 0,
    'supports_credentials' => true,
];
