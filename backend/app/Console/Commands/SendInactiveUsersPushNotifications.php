<?php

namespace App\Console\Commands;

use App\Jobs\SendUsersWebPushMessage;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SendInactiveUsersPushNotifications extends Command
{
    protected $signature = 'notifications:reengage-inactive-users {--days=2} {--limit=5000}';

    protected $description = 'Send a re-engagement push to users inactive for N days (phone push + in-app notification).';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        if ($days < 1) {
            $days = 2;
        }
        $limit = (int) $this->option('limit');
        if ($limit < 1) {
            $limit = 5000;
        }

        $cutoff = now()->subDays($days);
        $message = 'Tu nous manques ! Reviens découvrir les nouveautés sur PRIME Gaming.';
        $now = now();

        $processed = 0;

        $query = User::query()
            ->whereHas('pushSubscriptions')
            ->where(function ($q) {
                $q->whereNull('role')
                    ->orWhereNotIn('role', User::ADMIN_ROLES);
            })
            ->where(function ($q) use ($cutoff) {
                $q->where(function ($q2) use ($cutoff) {
                    $q2->whereNotNull('last_seen_at')->where('last_seen_at', '<=', $cutoff);
                })->orWhere(function ($q2) use ($cutoff) {
                    $q2->whereNull('last_seen_at')->where('created_at', '<=', $cutoff);
                });
            })
            ->whereRaw('reengagement_push_sent_at is null OR reengagement_push_sent_at < COALESCE(last_seen_at, created_at)');

        $query->select(['id'])->chunkById(500, function ($users) use (&$processed, $limit, $message, $now) {
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
                    'type' => 'reengagement',
                    'message' => $message,
                    'is_read' => false,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            try {
                DB::transaction(function () use ($rows, $userIds, $message, $now) {
                    Notification::insert($rows);
                    User::query()->whereIn('id', $userIds)->update(['reengagement_push_sent_at' => $now]);
                });
            } catch (\Throwable) {
                // best-effort: still attempt push
            }

            try {
                SendUsersWebPushMessage::dispatch(
                    userIds: $userIds,
                    title: 'PRIME Gaming',
                    body: $message,
                    url: '/shop'
                );
            } catch (\Throwable) {
                // best-effort
            }

            $processed += count($userIds);
            return $processed < $limit;
        });

        $this->info('Re-engagement pushes queued: ' . $processed);
        return self::SUCCESS;
    }
}
