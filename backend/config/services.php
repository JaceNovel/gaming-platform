<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'cinetpay' => [
        'api_key' => env('CINETPAY_API_KEY'),
        'site_id' => env('CINETPAY_SITE_ID'),
        'secret' => env('CINETPAY_SECRET'),
        'webhook_secret' => env('CINETPAY_WEBHOOK_SECRET', env('CINETPAY_SECRET')),
        'transfer_webhook_secret' => env('CINETPAY_TRANSFER_WEBHOOK_SECRET', env('CINETPAY_SECRET')),
        'base_url' => env('CINETPAY_BASE_URL', 'https://api-checkout.cinetpay.com/v2'),
    ],

    'discord' => [
        'webhook' => env('DISCORD_WEBHOOK_URL'),
    ],

    'play_integrity' => [
        'package_name' => env('PLAY_INTEGRITY_PACKAGE_NAME', 'space.primegaming.app'),
        'service_account_json' => env('PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON'),
        'service_account_path' => env('PLAY_INTEGRITY_SERVICE_ACCOUNT_PATH'),
    ],

    'brevo' => [
        'api_key' => env('BREVO_API_KEY'),
        'base_url' => env('BREVO_BASE_URL', 'https://api.brevo.com'),
    ],

    'paypal' => [
        'client_id' => env('PAYPAL_CLIENT_ID'),
        'client_secret' => env('PAYPAL_CLIENT_SECRET'),
        'environment' => env('PAYPAL_ENV', 'sandbox'),
        'base_url' => env('PAYPAL_BASE_URL'),
    ],

    'sourcing' => [
        'oauth_state_ttl_minutes' => (int) env('SOURCING_OAUTH_STATE_TTL_MINUTES', 15),
        'platforms' => [
            'alibaba' => [
                'authorize_url' => env('ALIBABA_OAUTH_AUTHORIZE_URL'),
                'token_url' => env('ALIBABA_OAUTH_TOKEN_URL'),
                'refresh_url' => env('ALIBABA_OAUTH_REFRESH_URL', env('ALIBABA_OAUTH_TOKEN_URL')),
                'api_base_url' => env('ALIBABA_API_BASE_URL'),
                'callback_url' => env('ALIBABA_CALLBACK_URL'),
                'default_scope' => env('ALIBABA_DEFAULT_SCOPE'),
                'product_detail_path' => env('ALIBABA_PRODUCT_DETAIL_PATH'),
                'product_lookup_param' => env('ALIBABA_PRODUCT_LOOKUP_PARAM', 'product_id'),
                'timeout' => (int) env('ALIBABA_REQUEST_TIMEOUT', 20),
            ],
            'aliexpress' => [
                'authorize_url' => env('ALIEXPRESS_OAUTH_AUTHORIZE_URL'),
                'token_url' => env('ALIEXPRESS_OAUTH_TOKEN_URL'),
                'refresh_url' => env('ALIEXPRESS_OAUTH_REFRESH_URL', env('ALIEXPRESS_OAUTH_TOKEN_URL')),
                'api_base_url' => env('ALIEXPRESS_API_BASE_URL'),
                'callback_url' => env('ALIEXPRESS_CALLBACK_URL'),
                'default_scope' => env('ALIEXPRESS_DEFAULT_SCOPE'),
                'product_detail_path' => env('ALIEXPRESS_PRODUCT_DETAIL_PATH'),
                'product_lookup_param' => env('ALIEXPRESS_PRODUCT_LOOKUP_PARAM', 'product_id'),
                'timeout' => (int) env('ALIEXPRESS_REQUEST_TIMEOUT', 20),
            ],
        ],
    ],

];
