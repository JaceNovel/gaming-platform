<?php

namespace App\Mail;

use App\Models\SiteSetting;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PaymentSuccess extends Mailable
{
    use Queueable, SerializesModels;

    public $order;
    public $logo;

    public function __construct($order)
    {
        $this->order = $order;
        $this->logo = SiteSetting::where('key', 'logo')->value('value');
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Paiement réussi - BADBOYSHOP'
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.payment_success',
            with: [
                'order' => $this->order,
                'logo' => $this->logo,
            ]
        );
    }
}