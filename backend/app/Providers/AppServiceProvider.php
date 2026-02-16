<?php

namespace App\Providers;

use App\Mail\Transport\BrevoTransport;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Symfony\Component\Mailer\Transport\TransportInterface;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->afterResolving('mail.manager', function ($manager) {
            $manager->extend('brevo', function (array $config = []): TransportInterface {
                $apiKey = (string) (config('services.brevo.api_key') ?? '');
                $baseUrl = (string) (config('services.brevo.base_url') ?? 'https://api.brevo.com');

                if ($apiKey === '') {
                    throw new \RuntimeException('BREVO_API_KEY is required when using MAIL_MAILER=brevo');
                }

                return new BrevoTransport(apiKey: $apiKey, baseUrl: $baseUrl);
            });
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('forgot-password', function (Request $request) {
            $ip = (string) ($request->ip() ?? 'unknown');
            $email = strtolower(trim((string) $request->input('email', '')));

            $response = function (Request $request, array $headers) {
                return response()->json(
                    ['message' => 'Trop de tentatives. Réessayez plus tard.'],
                    429,
                    $headers
                );
            };

            $limits = [
                // Primary guard: cap total requests per IP.
                Limit::perMinute(10)->by('forgot-password:ip:' . $ip),
            ];

            // Secondary guard: cap repeated attempts for the same email from same IP.
            if ($email !== '') {
                $limits[] = Limit::perMinute(5)
                    ->by('forgot-password:ip-email:' . $ip . '|' . sha1($email));
            }

            return collect($limits)
                ->map(fn (Limit $limit) => $limit->response($response))
                ->all();
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
