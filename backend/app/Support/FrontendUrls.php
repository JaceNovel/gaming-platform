<?php

namespace App\Support;

final class FrontendUrls
{
    public static function baseUrl(): string
    {
        $raw = (string) (env('FRONTEND_URL_WWW') ?: env('FRONTEND_URL') ?: 'https://primegaming.space');
        return rtrim($raw, '/');
    }

    public static function guidePdfUrl(): string
    {
        return self::baseUrl() . '/images/badboy.pdf';
    }
}
