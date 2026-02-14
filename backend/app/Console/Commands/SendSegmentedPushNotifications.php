<?php

namespace App\Console\Commands;

use App\Jobs\SendUsersFcmPushMessage;
use App\Jobs\SendUsersWebPushMessage;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SendSegmentedPushNotifications extends Command
{
    protected $signature = 'notifications:send-segment {segment} {--title=} {--body=} {--url=/notifications} {--limit=5000}';

    protected $description = 'Send a push notification to a user segment (new_users_24h, inactive_7d, free_fire_buyers, premium).';

    public function handle(): int
    {
        $segment = strtolower((string) $this->argument('segment'));
        $title = trim((string) $this->option('title')) ?: 'PRIME Gaming';
        $body = trim((string) $this->option('body'));
        $url = trim((string) $this->option('url')) ?: '/notifications';
        $limit = max(1, (int) $this->option('limit'));

        if ($body === '') {
            $this->error('Body is required (--body)');
            return self::FAILURE;
        }

        $query = User::query()
            ->where(function ($q) {
                $q->whereNull('role')
                    ->orWhereNotIn('role', User::ADMIN_ROLES);
            });

        if ($segment === 'new_users_24h') {
            $query->where('created_at', '>=', now()->subHours(24));
        } elseif ($segment === 'inactive_7d') {
            $cutoff = now()->subDays(7);
            $query->where(function ($q) use ($cutoff) {
                $q->whereNotNull('last_seen_at')->where('last_seen_at', '<=', $cutoff)
                    ->orWhere(function ($q2) use ($cutoff) {
                        $q2->whereNull('last_seen_at')->where('created_at', '<=', $cutoff);
                    });
            });
        } elseif ($segment === 'free_fire_buyers') {
            $query->whereHas('orders.orderItems.product.game', function ($q) {
                $q->where('slug', 'free-fire')
                    ->orWhereRaw('LOWER(name) LIKE ?', ['%free%fire%']);
            })->whereHas('orders', function ($q) {
                $q->where('status', 'payment_success');
            });
        } elseif ($segment === 'premium') {
            $query->where('is_premium', true);
        } else {
            $this->error('Unknown segment: ' . $segment);
            return self::FAILURE;
        }

        $processed = 0;
        $now = now();

        $query->select('id')->chunkById(500, function ($users) use (&$processed, $limit, $title, $body, $url, $now) {
            if ($processed >= $limit) {
                return false;
            }

            $userIds = $users->pluck('id')->map(fn ($id) => (int) $id)->all();
            if (empty($userIds)) {
                return true;
            }

            $remaining = $limit - $processed;
            if (count($userIds) > $remaining) {
                $userIds = array_slice($userIds, 0, $remaining);
            }

            $rows = [];
            foreach ($userIds as $userId) {
                $rows[] = [
                    'user_id' => $userId,
                    'type' => 'segment_push',
                    'message' => $body,
                    'is_read' => false,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            try {
                DB::transaction(function () use ($rows) {
                    Notification::insert($rows);
                });
            } catch (\Throwable) {
                // best-effort
            }

            try {
                SendUsersWebPushMessage::dispatch(
                    userIds: $userIds,
                    title: $title,
                    body: $body,
                    url: $url
                );
            } catch (\Throwable) {
                // best-effort
            }

            try {
                SendUsersFcmPushMessage::dispatch(
                    userIds: $userIds,
                    title: $title,
                    body: $body,
                    url: $url
                );
            } catch (\Throwable) {
                // best-effort
            }

            $processed += count($userIds);
            return $processed < $limit;
        });

        $this->info('Segment pushes queued: ' . $processed);
        return self::SUCCESS;
    }
}
