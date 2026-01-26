<?php

namespace App\Mail;

use App\Models\Order;
use App\Services\EmailTemplateRenderer;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class OutOfStockMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Order $order)
    {
        $this->subject('Commande payée – en attente de réapprovisionnement');
    }

    public function build(): self
    {
        $renderer = app(EmailTemplateRenderer::class);

        $context = [
            'order' => $this->order->toArray(),
            'user' => $this->order->user?->toArray() ?? [],
        ];

        $fallbackHtml = view('emails.out-of-stock', [
            'order' => $this->order,
        ])->render();

        $rendered = $renderer->render(
            'redeem_out_of_stock',
            $context,
            'Commande payée – en attente de réapprovisionnement',
            $fallbackHtml
        );

        return $this->subject($rendered['subject'])
            ->html($rendered['html'] ?? $fallbackHtml);
    }
}
