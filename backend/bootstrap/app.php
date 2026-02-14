<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Console\Scheduling\Schedule;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withSchedule(function (Schedule $schedule): void {
        // Auto-resync payments stuck in payment_processing by verifying providers.
        // Safe: never marks paid without provider confirmation.
        $schedule->command('payments:resync-stuck --minutes=5 --limit=50')
            ->everyFiveMinutes()
            ->withoutOverlapping();

        // Persistent admin notifications (Web Push) when new activity appears.
        $schedule->command('admin:activity-push --minutes=2 --limit=10')
            ->everyMinute()
            ->withoutOverlapping();

        // Automatically revoke VIP when premium expiration is reached.
        $schedule->command('premium:expire --limit=500')
            ->everyMinute()
            ->withoutOverlapping();

        // Re-engagement push for users inactive for 2 days.
        $schedule->command('notifications:reengage-inactive-users --days=2 --limit=5000')
            ->dailyAt('10:00')
            ->withoutOverlapping();

        // Abandoned cart reminders (every 2 hours).
        $schedule->command('notifications:cart-abandoned --hours=6 --order-hours=24 --limit=3000')
            ->everyTwoHours()
            ->withoutOverlapping();
    })
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(\Illuminate\Http\Middleware\HandleCors::class);
        $middleware->alias([
            'admin' => \App\Http\Middleware\AdminMiddleware::class,
            'role' => \App\Http\Middleware\RoleMiddleware::class,
            'requireRole' => \App\Http\Middleware\RoleMiddleware::class,
            'permission' => \App\Http\Middleware\PermissionMiddleware::class,
            'lastSeen' => \App\Http\Middleware\UpdateLastSeenAt::class,
            'playIntegrity' => \App\Http\Middleware\EnsurePlayIntegrity::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (AuthenticationException $e, $request) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'UNAUTHENTICATED'], 401);
            }

            return redirect()->guest('/login');
        });

        $exceptions->render(function (AuthorizationException $e, $request) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'FORBIDDEN'], 403);
            }

            return redirect()->guest('/');
        });
    })->create();
