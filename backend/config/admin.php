<?php

return [
    'log_role_denies' => (bool) env('ADMIN_LOG_ROLE_DENIES', false),

    'allowed_ips' => collect(explode(',', (string) env('ADMIN_ALLOWED_IPS', '')))
        ->map(fn (string $ip) => trim($ip))
        ->filter()
        ->values()
        ->all(),

    'owner_email' => env('OWNER_ADMIN_EMAIL', 'admin@primegaming.space'),
    'owner_password' => env('OWNER_ADMIN_PASSWORD', 'admin@primegaming.space'),
];
