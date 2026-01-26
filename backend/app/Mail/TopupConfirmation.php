<?php

namespace App\Mail;

use App\Services\EmailTemplateRenderer;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class TopupConfirmation extends Mailable
{
    use Queueable, SerializesModels;

    public $order;
    public $orderItem;

    public function __construct($order, $orderItem = null)
    {
        $this->order = $order;
        $this->orderItem = $orderItem;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Confirmation de recharge BADBOYSHOP'
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.topup_confirmation',
            with: [
                'order' => $this->order,
                'orderItem' => $this->orderItem,
                'topupDetails' => $this->orderItem->delivery_payload ?? $this->orderItem->game_user_id ?? [],
            ]
        );
    }

    public function attachments(): array
    {
        return [];
    }

    public function build(): self
    {
        $renderer = app(EmailTemplateRenderer::class);
        $fallbackHtml = view('emails.topup_confirmation', [
            'order' => $this->order,
            'orderItem' => $this->orderItem,
            'topupDetails' => $this->orderItem->delivery_payload ?? $this->orderItem->game_user_id ?? [],
        ])->render();

        $context = [
            'order' => $this->order->toArray(),
            'user' => $this->order->user?->toArray() ?? [],
        ];

        $rendered = $renderer->render(
            'topup_confirmation',
            $context,
            'Confirmation de recharge BADBOYSHOP',
            $fallbackHtml
        );

        return $this->subject($rendered['subject'])
            ->html($rendered['html'] ?? $fallbackHtml);
    }
}
