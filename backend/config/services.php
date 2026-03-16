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
                'authorize_url' => env('ALIBABA_OAUTH_AUTHORIZE_URL', 'https://openapi-auth.alibaba.com/oauth/authorize'),
                'token_url' => env('ALIBABA_OAUTH_TOKEN_URL', 'https://openapi.alibaba.com/auth/token/create'),
                'refresh_url' => env('ALIBABA_OAUTH_REFRESH_URL', 'https://openapi.alibaba.com/auth/token/refresh'),
                'api_base_url' => env('ALIBABA_API_BASE_URL', 'https://openapi.alibaba.com'),
                'callback_url' => env('ALIBABA_CALLBACK_URL'),
                'default_scope' => env('ALIBABA_DEFAULT_SCOPE'),
                'include_optional_authorize_params' => env('ALIBABA_INCLUDE_OPTIONAL_AUTHORIZE_PARAMS', false),
                'authorize_force_auth' => env('ALIBABA_AUTHORIZE_FORCE_AUTH', false),
                'authorize_uuid' => env('ALIBABA_AUTHORIZE_UUID'),
                'sign_method' => env('ALIBABA_SIGN_METHOD', 'sha256'),
                'product_detail_method' => env('ALIBABA_PRODUCT_DETAIL_METHOD', env('ALIBABA_PRODUCT_DETAIL_PATH', '/alibaba/icbu/product/get/v2')),
                'product_lookup_param' => env('ALIBABA_PRODUCT_LOOKUP_PARAM', 'product_id'),
                'product_search_method' => env('ALIBABA_PRODUCT_SEARCH_METHOD', '/alibaba/icbu/product/search/v2'),
                'category_predict_method' => env('ALIBABA_CATEGORY_PREDICT_METHOD', '/alibaba/icbu/category/predict/v2'),
                'video_upload_method' => env('ALIBABA_VIDEO_UPLOAD_METHOD', '/alibaba/icbu/video/upload'),
                'video_upload_result_method' => env('ALIBABA_VIDEO_UPLOAD_RESULT_METHOD', '/alibaba/icbu/video/upload/result'),
                'video_query_method' => env('ALIBABA_VIDEO_QUERY_METHOD', '/alibaba/icbu/video/query'),
                'video_relation_main_method' => env('ALIBABA_VIDEO_RELATION_MAIN_METHOD', '/alibaba/icbu/video/relation/product/main'),
                'buyer_item_add_method' => env('ALIBABA_BUYER_ITEM_ADD_METHOD', '/eco/buyer/item/add'),
                'buyer_item_query_method' => env('ALIBABA_BUYER_ITEM_QUERY_METHOD', '/eco/buyer/item/query'),
                'buyer_item_update_method' => env('ALIBABA_BUYER_ITEM_UPDATE_METHOD', '/eco/buyer/item/update'),
                'buyer_item_delete_method' => env('ALIBABA_BUYER_ITEM_DELETE_METHOD', '/eco/buyer/item/delete'),
                'buyer_product_events_method' => env('ALIBABA_BUYER_PRODUCT_EVENTS_METHOD', '/eco/buyer/product/events'),
                'buyer_product_channel_batch_import_method' => env('ALIBABA_BUYER_PRODUCT_CHANNEL_BATCH_IMPORT_METHOD', '/eco/buyer/product/channel/batch-import'),
                'buyer_crossborder_product_check_method' => env('ALIBABA_BUYER_CROSSBORDER_PRODUCT_CHECK_METHOD', '/eco/buyer/crossborder/product/check'),
                'buyer_product_cert_method' => env('ALIBABA_BUYER_PRODUCT_CERT_METHOD', '/eco/buyer/product/cert'),
                'buyer_product_description_method' => env('ALIBABA_BUYER_PRODUCT_DESCRIPTION_METHOD', '/eco/buyer/product/description'),
                'buyer_product_keyattributes_method' => env('ALIBABA_BUYER_PRODUCT_KEYATTRIBUTES_METHOD', '/eco/buyer/product/keyattributes'),
                'buyer_product_inventory_method' => env('ALIBABA_BUYER_PRODUCT_INVENTORY_METHOD', '/eco/buyer/product/inventory'),
                'buyer_local_product_check_method' => env('ALIBABA_BUYER_LOCAL_PRODUCT_CHECK_METHOD', '/eco/buyer/local/product/check'),
                'buyer_localregular_product_check_method' => env('ALIBABA_BUYER_LOCALREGULAR_PRODUCT_CHECK_METHOD', '/eco/buyer/localregular/product/check'),
                'buyer_item_rec_image_method' => env('ALIBABA_BUYER_ITEM_REC_IMAGE_METHOD', '/eco/buyer/item/rec/image'),
                'buyer_product_check_method' => env('ALIBABA_BUYER_PRODUCT_CHECK_METHOD', '/eco/buyer/product/check'),
                'buyer_product_search_method' => env('ALIBABA_BUYER_PRODUCT_SEARCH_METHOD', '/eco/buyer/product/search'),
                'buyer_item_rec_method' => env('ALIBABA_BUYER_ITEM_REC_METHOD', '/eco/buyer/item/rec'),
                'advanced_freight_calculate_method' => env('ALIBABA_ADVANCED_FREIGHT_CALCULATE_METHOD', '/order/freight/calculate'),
                'basic_freight_calculate_method' => env('ALIBABA_BASIC_FREIGHT_CALCULATE_METHOD', '/shipping/freight/calculate'),
                'merge_pay_query_method' => env('ALIBABA_MERGE_PAY_QUERY_METHOD', '/order/merge/pay/query'),
                'buynow_order_create_method' => env('ALIBABA_BUYNOW_ORDER_CREATE_METHOD', '/buynow/order/create'),
                'logistics_tracking_get_method' => env('ALIBABA_LOGISTICS_TRACKING_GET_METHOD', '/order/logistics/tracking/get'),
                'overseas_admittance_check_method' => env('ALIBABA_OVERSEAS_ADMITTANCE_CHECK_METHOD', '/icbu/check/overseas/admittance'),
                'dropshipping_order_pay_method' => env('ALIBABA_DROPSHIPPING_ORDER_PAY_METHOD', '/alibaba/dropshipping/order/pay'),
                'order_fund_query_method' => env('ALIBABA_ORDER_FUND_QUERY_METHOD', '/alibaba/order/fund/query'),
                'ggs_warehouse_list_method' => env('ALIBABA_GGS_WAREHOUSE_LIST_METHOD', '/alibaba/ggs/warehouse/list'),
                'order_attachment_upload_method' => env('ALIBABA_ORDER_ATTACHMENT_UPLOAD_METHOD', '/alibaba/order/attachment/upload'),
                'order_cancel_method' => env('ALIBABA_ORDER_CANCEL_METHOD', '/alibaba/order/cancel'),
                'order_get_method' => env('ALIBABA_ORDER_GET_METHOD', '/alibaba/order/get'),
                'order_list_method' => env('ALIBABA_ORDER_LIST_METHOD', '/alibaba/order/list'),
                'order_pay_result_query_method' => env('ALIBABA_ORDER_PAY_RESULT_QUERY_METHOD', '/alibaba/order/pay/result/query'),
                'seller_warehouse_list_method' => env('ALIBABA_SELLER_WAREHOUSE_LIST_METHOD', '/warehouse/list'),
                'order_logistics_query_method' => env('ALIBABA_ORDER_LOGISTICS_QUERY_METHOD', '/order/logistics/query'),
                'timeout' => (int) env('ALIBABA_REQUEST_TIMEOUT', 20),
            ],
            'aliexpress' => [
                'authorize_url' => env('ALIEXPRESS_OAUTH_AUTHORIZE_URL', 'https://openapi-auth.alibaba.com/oauth/authorize'),
                'token_url' => env('ALIEXPRESS_OAUTH_TOKEN_URL', 'https://openapi.alibaba.com/auth/token/create'),
                'refresh_url' => env('ALIEXPRESS_OAUTH_REFRESH_URL', 'https://openapi.alibaba.com/auth/token/refresh'),
                'api_base_url' => env('ALIEXPRESS_API_BASE_URL', 'https://openapi.alibaba.com'),
                'callback_url' => env('ALIEXPRESS_CALLBACK_URL'),
                'default_scope' => env('ALIEXPRESS_DEFAULT_SCOPE'),
                'include_optional_authorize_params' => env('ALIEXPRESS_INCLUDE_OPTIONAL_AUTHORIZE_PARAMS', false),
                'authorize_force_auth' => env('ALIEXPRESS_AUTHORIZE_FORCE_AUTH', false),
                'authorize_uuid' => env('ALIEXPRESS_AUTHORIZE_UUID'),
                'sign_method' => env('ALIEXPRESS_SIGN_METHOD', 'sha256'),
                'product_detail_method' => env('ALIEXPRESS_PRODUCT_DETAIL_METHOD', env('ALIEXPRESS_PRODUCT_DETAIL_PATH')),
                'product_lookup_param' => env('ALIEXPRESS_PRODUCT_LOOKUP_PARAM', 'product_id'),
                'timeout' => (int) env('ALIEXPRESS_REQUEST_TIMEOUT', 20),
            ],
        ],
    ],

];
