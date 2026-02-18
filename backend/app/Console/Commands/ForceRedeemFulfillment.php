<?php

namespace App\Console\Commands;

use App\Jobs\ProcessRedeemFulfillment;
use App\Models\Order;
use Illuminate\Console\Command;

class ForceRedeemFulfillment extends Command
{
    protected $signature = 'orders:redeem-fulfill
        {order : Order ID or reference (e.g. 123 or ORD-XXXX)}
        {--sync : Run synchronously (dispatchSync) instead of queueing}
        {--email-only : Only resend already assigned codes via email (no allocation)}';

    protected $description = 'Force redeem fulfillment for an order (allocate redeem codes + send email)';

    public function handle(): int
    {
        $needle = (string) $this->argument('order');

        $order = Order::query()
            ->when(ctype_digit($needle), function ($q) use ($needle) {
                $q->where('id', (int) $needle);
            }, function ($q) use ($needle) {
                $q->where('reference', $needle);
            })
            ->first();

        if (!$order) {
            $this->error('Order not found');
            return self::FAILURE;
        }

        $order->loadMissing(['user', 'orderItems.product']);

        $this->line(sprintf('Order #%d ref=%s status=%s user=%s', $order->id, (string) ($order->reference ?? ''), (string) ($order->status ?? ''), (string) ($order->user?->email ?? $order->user_id ?? 'n/a')));

        if (!$order->isPaymentSuccess()) {
            $this->warn('Order is not payment_success; fulfillment may be blocked by business rules.');
        }

        if (!$order->requiresRedeemFulfillment()) {
            $this->warn('Order does not require redeem fulfillment.');
            return self::SUCCESS;
        }

        if ((bool) $this->option('email-only')) {
            $this->warn('--email-only is not implemented as a separate path here; use the admin resend endpoint if codes are already assigned.');
            $this->line('Admin endpoint: POST /api/orders/{order}/resend-code');
            return self::SUCCESS;
        }

        if ((bool) $this->option('sync')) {
            ProcessRedeemFulfillment::dispatchSync($order->id);
            $this->info('Redeem fulfillment dispatched synchronously.');
        } else {
            ProcessRedeemFulfillment::dispatch($order->id);
            $this->info('Redeem fulfillment queued.');
        }

        return self::SUCCESS;
    }
}
