<?php

namespace App\Services;

use App\Models\Order;
use App\Models\GameAccount;

class DeliveryService
{
    public function sendAccountDeliveryEmail(Order $order, GameAccount $account)
    {
        $details = json_decode($account->account_details, true);

        $front = rtrim((string) (env('FRONTEND_URL', config('app.url'))), '/');
        $freeFireGuideFilename = '🔐 Procédure de liaison du compte Free Fire.pdf';
        $freeFireGuideUrl = $front !== ''
            ? $front . '/images/' . rawurlencode($freeFireGuideFilename)
            : null;

        $data = [
            'order' => $order,
            'account_details' => $details,
            'game' => $account->game,
            'front_url' => $front,
            'free_fire_guide_url' => $freeFireGuideUrl,
            'chat_url' => $front !== '' ? ($front . '/chat') : null,
            'appointment_rate' => '1000 FCFA / heure',
        ];

        $to = (string) ($order->user?->email ?? '');
        $userId = $order->user_id ? (int) $order->user_id : null;

        /** @var LoggedEmailService $logged */
        $logged = app(LoggedEmailService::class);
        $logged->queue(
            userId: $userId,
            to: $to,
            type: 'account_delivery',
            subject: 'Vos identifiants de jeu PRIME Gaming',
            mailable: new \App\Mail\AccountDelivery($data),
            meta: ['order_id' => $order->id, 'game_id' => $account->game_id]
        );
    }
}