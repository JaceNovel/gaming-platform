<?php

namespace App\Mail;

use App\Models\SiteSetting;
use App\Services\EmailTemplateRenderer;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class RefundIssued extends Mailable
{
    use Queueable, SerializesModels;

    public $order;
    public $refund;
    public $logo;

    public function __construct($order, $refund)
    {
        $this->order = $order;
        $this->refund = $refund;
        $this->logo = SiteSetting::where('key', 'logo')->value('value');
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Remboursement crédité sur votre wallet - BADBOYSHOP'
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.refund_issued',
            with: [
                'order' => $this->order,
                'refund' => $this->refund,
                'logo' => $this->logo,
            ]
        );
    }

    public function build(): self
    {
        $renderer = app(EmailTemplateRenderer::class);
        $fallbackHtml = view('emails.refund_issued', [
            'order' => $this->order,
            'refund' => $this->refund,
            'logo' => $this->logo,
        ])->render();

        $context = [
            'order' => $this->order->toArray(),
            'refund' => $this->refund->toArray(),
            'user' => $this->order->user?->toArray() ?? [],
        ];

        $rendered = $renderer->render(
            'refund_issued',
            $context,
            'Remboursement crédité sur votre wallet - BADBOYSHOP',
            $fallbackHtml
        );

        return $this->subject($rendered['subject'])
            ->html($rendered['html'] ?? $fallbackHtml);
    }
}
