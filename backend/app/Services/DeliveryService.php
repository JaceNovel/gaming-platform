<?php

namespace App\Services;

use App\Models\Order;
use App\Models\GameAccount;
use Illuminate\Support\Facades\Mail;

class DeliveryService
{
    public function sendAccountDeliveryEmail(Order $order, GameAccount $account)
    {
        $details = json_decode($account->account_details, true);

        $data = [
            'order' => $order,
            'account_details' => $details,
            'game' => $account->game,
        ];

        Mail::to($order->user->email)->send(new \App\Mail\AccountDelivery($data));
    }
}