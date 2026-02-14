<?php

namespace App\Console\Commands;

use App\Jobs\SendUsersFcmPushMessage;
use App\Jobs\SendUsersWebPushMessage;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SendAbandonedCartPushNotifications extends Command
{
    protected $signature = 'notifications:cart-abandoned {--hours=6} {--order-hours=24} {--limit=2000}';

    protected $description = 'Send a reminder push to users with abandoned cart items.';

    public function handle(): int
    {
        $hours = max(1, (int) $this->option('hours'));
        $orderHours = max(1, (int) $this->option('order-hours'));
        $limit = max(1, (int) $this->option('limit'));

        $cutoff = now()->subHours($hours);
        $recentOrderCutoff = now()->subHours($orderHours);
        $title = 'PRIME Gaming';
        $body = 'Ton panier t\'attend. Finalise ta commande avant que les stocks ne bougent.';
        $url = '/cart';
        $now = now();

        $query = User::query()
            ->where(function ($q) {
                $q->whereNull('role')
                    ->orWhereNotIn('role', User::ADMIN_ROLES);
            })
            ->whereHas('cartItems', function ($q) use ($cutoff) {
                $q->where('updated_at', '<=', $cutoff);
            })
            ->whereDoesntHave('orders', function ($q) use ($recentOrderCutoff) {
                $q->where('created_at', '>=', $recentOrderCutoff);
            });

        $processed = 0;

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
                    'type' => 'cart_abandoned',
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

        $this->info('Abandoned cart pushes queued: ' . $processed);
        return self::SUCCESS;
    }
}
