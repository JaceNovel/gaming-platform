<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\AdminActivityService;
use App\Services\WebPushService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class SendAdminActivityPushNotifications extends Command
{
    protected $signature = 'admin:activity-push {--minutes=2} {--limit=10} {--dry-run}';

    protected $description = 'Send persistent Web Push notifications to admins when new activity appears.';

    public function handle(AdminActivityService $activity, WebPushService $webPush): int
    {
        $publicKey = (string) env('VAPID_PUBLIC_KEY', '');
        $privateKey = (string) env('VAPID_PRIVATE_KEY', '');
        if ($publicKey === '' || $privateKey === '') {
            // Not configured: silently succeed.
            return self::SUCCESS;
        }

        $minutes = max(1, min(60, (int) $this->option('minutes')));
        $limit = max(1, min(30, (int) $this->option('limit')));
        $dryRun = (bool) $this->option('dry-run');

        $cacheKey = 'bb_admin_activity_push_last_sent_at';
        $lastSentRaw = Cache::get($cacheKey);

        $since = null;
        if (is_string($lastSentRaw) && trim($lastSentRaw) !== '') {
            try {
                $since = Carbon::parse($lastSentRaw);
            } catch (\Throwable $e) {
                $since = null;
            }
        }

        if (!$since) {
            $since = Carbon::now()->subMinutes($minutes);
        }

        $admins = User::query()
            ->whereIn('role', User::ADMIN_ROLES)
            ->whereHas('pushSubscriptions')
            ->get();

        if ($admins->isEmpty()) {
            return self::SUCCESS;
        }

        $anySent = false;
        foreach ($admins as $admin) {
            // Only admins who can see the dashboard receive the feed pushes.
            if (!$admin->hasPermission('dashboard.view')) {
                continue;
            }

            $result = $activity->recentForUser($admin, $since, $limit);
            $items = is_array($result['items'] ?? null) ? $result['items'] : [];
            if (count($items) === 0) {
                continue;
            }

            $top = array_slice($items, 0, 3);
            $body = implode(' | ', array_map(function ($it) {
                return (string) ($it['title'] ?? '');
            }, $top));
            $body = trim($body);
            if ($body === '') {
                $body = 'Nouveaux événements admin';
            }

            $url = (string) (($items[0]['href'] ?? '') ?: '/admin/dashboard');
            if (!str_starts_with($url, '/')) {
                $url = '/admin/dashboard';
            }

            $payload = [
                'title' => 'Admin — ' . count($items) . ' nouveauté(s)',
                'body' => $body,
                'url' => $url,
            ];

            if ($dryRun) {
                $this->line('Would push to admin #' . $admin->id . ': ' . $payload['title']);
                $anySent = true;
                continue;
            }

            $webPush->sendToUser($admin, $payload);
            $anySent = true;
        }

        if ($anySent && !$dryRun) {
            Cache::put($cacheKey, Carbon::now()->toIso8601String(), now()->addDays(30));
        }

        return self::SUCCESS;
    }
}
