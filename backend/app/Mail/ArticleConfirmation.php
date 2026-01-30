<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ArticleConfirmation extends Mailable
{
    use Queueable, SerializesModels;

    public $order;
    public $orderItem;

    /**
     * Create a new message instance.
     */
    public function __construct($order, $orderItem = null)
    {
        $this->order = $order;
        $this->orderItem = $orderItem;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Commande confirmée - Livraison',
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.article_confirmation',
            with: [
                'order' => $this->order,
                'orderItem' => $this->orderItem,
                'article' => $this->orderItem->product ?? null,
            ],
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
