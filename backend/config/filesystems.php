<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    // Disk used for publicly visible uploads (marketplace listing photos, dispute evidence, etc.).
    // Keep default as 'public' (local) but allow switching to 's3' in production.
    'public_uploads_disk' => env('PUBLIC_UPLOADS_DISK', 'public'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        // Legacy fallback for older deployments that wrote files directly under storage/app.
        // This disk should not be used for new writes.
        'legacy_app' => [
            'driver' => 'local',
            'root' => storage_path('app'),
            'serve' => false,
            'throw' => false,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            // Serve public uploads through the API to avoid relying on web server symlink/static config.
            // Example: https://api.primegaming.space/api/storage/seller-listings/xxx.png
            'url' => (function () {
                $base = rtrim((string) (env('APP_URL') ?: config('app.url') ?: ''), '/');
                if ($base === '') {
                    // Fallback (should be avoided in production): keep relative URLs.
                    return '/api/storage';
                }
                if (str_ends_with($base, '/api')) {
                    $base = substr($base, 0, -4);
                }
                return $base . '/api/storage';
            })(),
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            // These uploads are intended to be publicly viewable (listing photos, dispute evidence).
            // For private/sensitive files, use the 'local' disk.
            'visibility' => env('AWS_PUBLIC_UPLOADS_VISIBILITY', 'public'),
            'throw' => false,
            'report' => false,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
