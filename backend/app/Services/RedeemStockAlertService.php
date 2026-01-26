<?php

namespace App\Services;

use App\Mail\LowStockAdminMail;
use App\Models\RedeemDenomination;
use App\Models\RedeemStockAlert;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;

class RedeemStockAlertService
{
    public function notifyIfLowStock(RedeemDenomination $denomination): void
    {
        $threshold = $this->thresholdFor($denomination);
        if ($threshold === null) {
            return;
        }

        $available = $denomination->availableStock();
        if ($available > $threshold) {
            return;
        }

        $alert = RedeemStockAlert::firstOrCreate([
            'denomination_id' => $denomination->id,
        ]);

        $shouldNotify = !$alert->last_notified_at
            || $available < (int) ($alert->last_notified_stock ?? PHP_INT_MAX)
            || $alert->last_notified_at->lt(now()->subHours(24));

        if (!$shouldNotify) {
            return;
        }

        $product = $denomination->product;
        $channels = strtolower((string) ($product?->stock_alert_channel ?? 'email'));

        if ($channels === 'email' || $channels === 'both') {
            $recipients = $this->resolveEmails($product?->stock_alert_emails);
            foreach ($recipients as $email) {
                Mail::to($email)->queue(new LowStockAdminMail($denomination, $available, $threshold));
            }
        }

        if (($channels === 'discord' || $channels === 'both') && config('services.discord.webhook')) {
            Http::post(config('services.discord.webhook'), [
                'content' => sprintf(
                    "⚠️ Stock bas: %s - %d codes restants (seuil: %d)",
                    $product?->name ?? $denomination->label ?? 'Produit',
                    $available,
                    $threshold
                ),
            ]);
        }

        $alert->update([
            'last_notified_stock' => $available,
            'last_notified_at' => now(),
            'channel' => $channels,
        ]);
    }

    private function thresholdFor(RedeemDenomination $denomination): ?int
    {
        if (!is_null($denomination->low_stock_threshold)) {
            return (int) $denomination->low_stock_threshold;
        }

        return $denomination->product?->stock_low_threshold;
    }

    private function resolveEmails(?string $emails): array
    {
        $owner = config('mail.owner_email') ?? env('OWNER_ADMIN_EMAIL');
        $list = $emails ? preg_split('/\s*,\s*/', $emails) : [];
        $recipients = array_filter(array_merge([$owner], $list));

        return array_values(array_unique($recipients));
    }
}
