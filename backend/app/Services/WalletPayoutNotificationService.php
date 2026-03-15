<?php

namespace App\Services;

use App\Mail\TemplatedNotification;
use App\Models\Notification;
use App\Models\Payout;

class WalletPayoutNotificationService
{
    private function frontendUrl(string $path = '/wallet'): string
    {
        $base = rtrim((string) (env('FRONTEND_URL', config('app.url'))), '/');
        return $base . '/' . ltrim($path, '/');
    }

    public function notifySent(Payout $payout): void
    {
        $payout->loadMissing('user');
        $user = $payout->user;
        if (!$user) {
            return;
        }

        $amount = (float) ($payout->amount ?? 0);
        $message = 'Ton retrait wallet de ' . number_format($amount, 0, ',', ' ') . ' FCFA a été envoyé.';

        try {
            Notification::create([
                'user_id' => $user->id,
                'type' => 'wallet_payout_sent',
                'message' => $message,
            ]);
        } catch (\Throwable) {
        }

        if (!$user->email) {
            return;
        }

        try {
            $subject = 'Retrait wallet envoyé - PRIME Gaming';
            $mailable = new TemplatedNotification(
                'wallet_payout_sent',
                $subject,
                [
                    'payout' => $payout->toArray(),
                    'user' => $user->toArray(),
                ],
                [
                    'title' => $subject,
                    'headline' => 'Retrait envoyé',
                    'intro' => 'Ton retrait wallet a été envoyé via FedaPay.',
                    'details' => [
                        ['label' => 'Montant net', 'value' => number_format($amount, 0, ',', ' ') . ' FCFA'],
                        ['label' => 'Frais', 'value' => number_format((float) ($payout->fee ?? 0), 0, ',', ' ') . ' FCFA'],
                        ['label' => 'Référence payout', 'value' => (string) ($payout->provider_ref ?? $payout->id)],
                    ],
                    'actionUrl' => $this->frontendUrl('/wallet'),
                    'actionText' => 'Voir mon wallet',
                ]
            );

            /** @var LoggedEmailService $logged */
            $logged = app(LoggedEmailService::class);
            $logged->queue($user->id, $user->email, 'wallet_payout_sent', $subject, $mailable, [
                'payout_id' => $payout->id,
            ]);
        } catch (\Throwable) {
        }
    }

    public function notifyFailed(Payout $payout, ?string $reason = null): void
    {
        $payout->loadMissing('user');
        $user = $payout->user;
        if (!$user) {
            return;
        }

        $amount = (float) ($payout->amount ?? 0);
        $failureReason = trim((string) ($reason ?? $payout->failure_reason ?? ''));
        $message = 'Ton retrait wallet de ' . number_format($amount, 0, ',', ' ') . ' FCFA a échoué. Le montant a été reversé sur ton wallet.';

        try {
            Notification::create([
                'user_id' => $user->id,
                'type' => 'wallet_payout_failed',
                'message' => $message,
            ]);
        } catch (\Throwable) {
        }

        if (!$user->email) {
            return;
        }

        try {
            $subject = 'Retrait wallet échoué - PRIME Gaming';
            $mailable = new TemplatedNotification(
                'wallet_payout_failed',
                $subject,
                [
                    'payout' => $payout->toArray(),
                    'user' => $user->toArray(),
                    'reason' => $failureReason,
                ],
                [
                    'title' => $subject,
                    'headline' => 'Retrait échoué',
                    'intro' => 'Le retrait n’a pas pu être envoyé. Le montant total a été recrédité sur ton wallet.',
                    'details' => [
                        ['label' => 'Montant net', 'value' => number_format($amount, 0, ',', ' ') . ' FCFA'],
                        ['label' => 'Montant recrédité', 'value' => number_format((float) ($payout->total_debit ?? 0), 0, ',', ' ') . ' FCFA'],
                        ['label' => 'Motif', 'value' => $failureReason !== '' ? $failureReason : 'Erreur payout'],
                    ],
                    'actionUrl' => $this->frontendUrl('/wallet'),
                    'actionText' => 'Voir mon wallet',
                ]
            );

            /** @var LoggedEmailService $logged */
            $logged = app(LoggedEmailService::class);
            $logged->queue($user->id, $user->email, 'wallet_payout_failed', $subject, $mailable, [
                'payout_id' => $payout->id,
            ]);
        } catch (\Throwable) {
        }
    }
}