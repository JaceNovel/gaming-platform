<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('forgot-password', function (Request $request) {
            $ip = (string) ($request->ip() ?? 'unknown');
            $email = strtolower(trim((string) $request->input('email', '')));
            $key = $ip;
            if ($email !== '') {
                $key .= '|' . sha1($email);
            }

            return Limit::perMinute(5)
                ->by('forgot-password:' . $key)
                ->response(function (Request $request, array $headers) {
                    return response()->json(
                        ['message' => 'Trop de tentatives. Réessayez plus tard.'],
                        429,
                        $headers
                    );
                });
        });

        RateLimiter::for('reset-password', function (Request $request) {
            $ip = (string) ($request->ip() ?? 'unknown');

            return Limit::perMinute(10)
                ->by('reset-password:' . $ip)
                ->response(function (Request $request, array $headers) {
                    return response()->json(
                        ['message' => 'Trop de tentatives. Réessayez plus tard.'],
                        429,
                        $headers
                    );
                });
        });
    }
}
