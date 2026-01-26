<?php

namespace App\Mail;

use App\Models\SiteSetting;
use App\Services\EmailTemplateRenderer;
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

    public function build(): self
    {
        $renderer = app(EmailTemplateRenderer::class);
        $fallbackHtml = view('emails.payment_success', [
            'order' => $this->order,
            'logo' => $this->logo,
        ])->render();

        $context = [
            'order' => $this->order->toArray(),
            'user' => $this->order->user?->toArray() ?? [],
        ];

        $rendered = $renderer->render(
            'payment_success',
            $context,
            'Paiement réussi - BADBOYSHOP',
            $fallbackHtml
        );

        return $this->subject($rendered['subject'])
            ->html($rendered['html'] ?? $fallbackHtml);
    }
}