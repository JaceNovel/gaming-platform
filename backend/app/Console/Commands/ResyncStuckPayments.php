<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\Payment;
use App\Services\PaymentResyncService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ResyncStuckPayments extends Command
{
    protected $signature = 'payments:resync-stuck
        {--minutes=5 : Only resync payments older than N minutes}
        {--limit=50 : Maximum number of payments to process}
        {--method=all : Filter by provider method: all|fedapay|cinetpay}
    ';

    protected $description = 'Resync stuck payment_processing orders by querying the payment provider (safe, provider-verified).';

    public function handle(PaymentResyncService $paymentResyncService): int
    {
        $minutes = max(0, (int) $this->option('minutes'));
        $limit = max(1, (int) $this->option('limit'));
        $method = strtolower((string) $this->option('method'));

        $query = Payment::query()
            ->with(['order' => function ($q) {
                $q->with(['orderItems.product', 'user']);
            }])
            ->where('status', 'pending')
            ->whereNotNull('transaction_id')
            ->whereHas('order', function ($q) {
                $q->where('status', Order::STATUS_PAYMENT_PROCESSING);
            });

        if ($minutes > 0) {
            $query->where('created_at', '<=', now()->subMinutes($minutes));
        }

        if (in_array($method, ['fedapay', 'cinetpay'], true)) {
            $query->where('method', $method);
        }

        $payments = $query->orderBy('id')->limit($limit)->get();

        if ($payments->isEmpty()) {
            $this->info('No stuck payments found.');
            return self::SUCCESS;
        }

        $this->info(sprintf('Resyncing %d payment(s)...', $payments->count()));

        $counts = ['completed' => 0, 'failed' => 0, 'pending' => 0, 'error' => 0];

        foreach ($payments as $payment) {
            try {
                $status = $paymentResyncService->resync($payment, [
                    'source' => 'artisan',
                    'command' => 'payments:resync-stuck',
                ]);

                $counts[$status] = ($counts[$status] ?? 0) + 1;

                $this->line(sprintf(
                    'Payment #%d order #%s -> %s',
                    $payment->id,
                    (string) ($payment->order_id ?? 'n/a'),
                    $status
                ));
            } catch (\Throwable $e) {
                $counts['error']++;

                Log::error('payments:resync-stuck:error', [
                    'payment_id' => $payment->id,
                    'order_id' => $payment->order_id,
                    'transaction_id' => $payment->transaction_id,
                    'method' => $payment->method,
                    'message' => $e->getMessage(),
                ]);

                $this->error(sprintf(
                    'Payment #%d order #%s -> error (%s)',
                    $payment->id,
                    (string) ($payment->order_id ?? 'n/a'),
                    $e->getMessage()
                ));
            }
        }

        $this->info('Done. ' . json_encode($counts));

        return $counts['error'] > 0 ? self::FAILURE : self::SUCCESS;
    }
}
