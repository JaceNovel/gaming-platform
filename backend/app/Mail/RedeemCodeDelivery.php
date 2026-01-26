<?php

namespace App\Mail;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class RedeemCodeDelivery extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Order $order, public array $codes)
    {
        $this->subject('Votre recharge Free Fire est prête');
    }

    public function build(): self
    {
        return $this->markdown('emails.redeem-code-delivery', [
            'order' => $this->order,
            'codes' => $this->codes,
        ]);
    }
}
