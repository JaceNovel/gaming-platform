<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\Referral;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Services\WalletService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class BackfillReferralCommissions extends Command
{
    protected $signature = 'referrals:backfill-commissions
        {--from= : Start date (YYYY-MM-DD), filters orders.created_at >= from}
        {--to= : End date (YYYY-MM-DD), filters orders.created_at < to+1day}
        {--order= : Order reference or numeric id to backfill a single order}
        {--dry-run : Do not write changes}
        {--limit=500 : Max number of orders to process}';

    protected $description = 'Backfill missing referral commissions for first wallet topup (idempotent).';

    public function handle(WalletService $walletService): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $limit = max(1, (int) ($this->option('limit') ?? 500));

        $orderFilter = trim((string) ($this->option('order') ?? ''));
        $from = trim((string) ($this->option('from') ?? ''));
        $to = trim((string) ($this->option('to') ?? ''));

        $query = Order::query()
            ->with(['payment', 'user'])
            ->where('type', 'wallet_topup')
            ->where('status', Order::STATUS_PAYMENT_SUCCESS)
            ->orderBy('id');

        if ($orderFilter !== '') {
            $query->where(function ($q) use ($orderFilter) {
                if (ctype_digit($orderFilter)) {
                    $q->where('id', (int) $orderFilter);
                }
                $q->orWhere('reference', $orderFilter);
            });
        }

        if ($from !== '') {
            $fromDate = Carbon::parse($from)->startOfDay();
            $query->where('created_at', '>=', $fromDate);
        }

        if ($to !== '') {
            $toDate = Carbon::parse($to)->addDay()->startOfDay();
            $query->where('created_at', '<', $toDate);
        }

        $orders = $query->limit($limit)->get();

        $this->info(sprintf('Found %d wallet_topup order(s) to scan%s.', $orders->count(), $dryRun ? ' (dry-run)' : ''));

        $credited = 0;
        $skipped = 0;

        foreach ($orders as $order) {
            $referral = Referral::query()->where('referred_id', $order->user_id)->first();
            if (!$referral) {
                $skipped++;
                $this->line("skip order={$order->id} reason=no_referral");
                continue;
            }

            $alreadyEarned = (float) ($referral->commission_earned ?? 0);
            if ($alreadyEarned > 0.0 || $referral->rewarded_at) {
                $skipped++;
                $this->line("skip order={$order->id} reason=already_rewarded");
                continue;
            }

            $referrer = User::query()->find($referral->referrer_id);
            if (!$referrer) {
                $skipped++;
                $this->line("skip order={$order->id} reason=missing_referrer");
                continue;
            }

            $refTxRef = 'REFERRAL-' . $order->id;
            $existingTx = WalletTransaction::query()
                ->where('reference', $refTxRef)
                ->where('status', 'success')
                ->first();

            if ($existingTx) {
                // Wallet was credited but referral row was never updated.
                if (!$dryRun) {
                    $rate = (float) ($existingTx->meta['rate'] ?? null);
                    $baseAmount = (float) ($existingTx->meta['base_amount'] ?? 0);
                    $amount = (float) ($existingTx->amount ?? 0);
                    $referral->update([
                        'commission_earned' => $amount,
                        'commission_rate' => $rate > 0 ? $rate : null,
                        'commission_base_amount' => $baseAmount > 0 ? $baseAmount : null,
                        'rewarded_at' => $referral->rewarded_at ?? now(),
                    ]);
                }

                $credited++;
                $this->line("fix order={$order->id} reason=tx_exists_referral_updated amount={$existingTx->amount}");
                continue;
            }

            $isVip = (bool) $referrer->is_premium
                && in_array((string) $referrer->premium_level, ['bronze', 'or', 'platine'], true);

            $rate = $isVip ? 0.05 : 0.03;

            $baseAmount = (float) ($order->payment?->amount ?? $order->total_price ?? 0);
            if (!is_finite($baseAmount) || $baseAmount <= 0) {
                $skipped++;
                $this->line("skip order={$order->id} reason=invalid_amount");
                continue;
            }

            $commission = round($baseAmount * $rate, 2);
            if ($commission <= 0) {
                $skipped++;
                $this->line("skip order={$order->id} reason=zero_commission");
                continue;
            }

            if ($dryRun) {
                $this->line(sprintf('would-credit order=%d referrer=%d rate=%.2f%% base=%.2f amount=%.2f', $order->id, $referrer->id, $rate * 100, $baseAmount, $commission));
                $credited++;
                continue;
            }

            DB::transaction(function () use ($walletService, $referrer, $referral, $order, $commission, $rate, $baseAmount) {
                $walletService->credit($referrer, 'REFERRAL-' . $order->id, $commission, [
                    'type' => $rate >= 0.05 ? 'vip_referral_bonus' : 'referral_bonus',
                    'referred_user_id' => $order->user_id,
                    'order_id' => $order->id,
                    'payment_id' => $order->payment_id,
                    'rate' => $rate,
                    'base_amount' => $baseAmount,
                    'source' => 'referrals_backfill',
                ]);

                $referral->update([
                    'commission_earned' => $commission,
                    'commission_rate' => $rate,
                    'commission_base_amount' => $baseAmount,
                    'rewarded_at' => now(),
                ]);
            });

            $credited++;
            $this->line(sprintf('credited order=%d referrer=%d amount=%.2f', $order->id, $referrer->id, $commission));
        }

        $this->info(sprintf('Done. credited_or_fixed=%d skipped=%d', $credited, $skipped));

        return self::SUCCESS;
    }
}
