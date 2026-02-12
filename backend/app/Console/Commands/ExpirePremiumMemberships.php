<?php

namespace App\Console\Commands;

use App\Models\PremiumMembership;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ExpirePremiumMemberships extends Command
{
    protected $signature = 'premium:expire
        {--limit=500 : Maximum number of users to expire per run}
        {--dry-run : Do not persist changes}
    ';

    protected $description = 'Automatically removes VIP (premium) from users whose premium expiration has passed.';

    public function handle(): int
    {
        $limit = max(1, (int) $this->option('limit'));
        $dryRun = (bool) $this->option('dry-run');

        $now = now();
        $fetchLimit = $limit * 5;

        $candidates = User::query()
            ->where('is_premium', true)
            ->whereNotNull('premium_expiration')
            ->where('premium_expiration', '<=', $now)
            ->orderBy('id')
            ->limit($fetchLimit)
            ->get(['id', 'premium_expiration', 'premium_level']);

        if ($candidates->isEmpty()) {
            $this->info('No expired VIP users found.');
            return self::SUCCESS;
        }

        $expiredUserIds = [];

        foreach ($candidates as $user) {
            $expiration = $user->premium_expiration;
            if (!$expiration) {
                continue;
            }

            $expirationAt = $expiration instanceof Carbon
                ? $expiration->copy()
                : Carbon::parse((string) $expiration);

            // Some historical records stored only a DATE (midnight). Treat as end-of-day to avoid expiring too early.
            $effectiveExpiration = $expirationAt->format('H:i:s') === '00:00:00'
                ? $expirationAt->endOfDay()
                : $expirationAt;

            if ($effectiveExpiration->lessThanOrEqualTo($now)) {
                $expiredUserIds[] = (int) $user->id;
            }

            if (count($expiredUserIds) >= $limit) {
                break;
            }
        }

        if (empty($expiredUserIds)) {
            $this->info('No expired VIP users found after applying end-of-day rule.');
            return self::SUCCESS;
        }

        $this->info(sprintf('Expiring VIP for %d user(s)%s...', count($expiredUserIds), $dryRun ? ' (dry-run)' : ''));

        if ($dryRun) {
            $this->line('User IDs: ' . implode(',', $expiredUserIds));
            return self::SUCCESS;
        }

        DB::transaction(function () use ($expiredUserIds) {
            User::query()
                ->whereIn('id', $expiredUserIds)
                ->update([
                    'is_premium' => false,
                    'premium_level' => null,
                    'premium_expiration' => null,
                ]);

            PremiumMembership::query()
                ->whereIn('user_id', $expiredUserIds)
                ->where('is_active', true)
                ->update([
                    'is_active' => false,
                ]);
        });

        $this->info('Done.');

        return self::SUCCESS;
    }
}
