<?php

namespace App\Mail;

use App\Models\Order;
use App\Services\EmailTemplateRenderer;
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
        $renderer = app(EmailTemplateRenderer::class);
        $codes = array_map(function ($code) {
            $denomination = $code->denomination;
            return [
                'code' => $code->code,
                'label' => $denomination?->label,
                'diamonds' => $denomination?->diamonds,
            ];
        }, $this->codes);

        $codesHtml = collect($codes)->map(function ($item) {
            $label = $item['label'] ?? 'Recharge';
            $diamonds = $item['diamonds'] ?? '';
            $code = $item['code'] ?? '';
            return "<li><strong>{$label} ({$diamonds} diamants)</strong> : {$code}</li>";
        })->implode('');

        $context = [
            'order' => $this->order->toArray(),
            'user' => $this->order->user?->toArray() ?? [],
            'codes_html' => "<ul>{$codesHtml}</ul>",
            'guide_url' => url('/api/guides/shop2game-freefire'),
        ];

        $fallbackHtml = view('emails.redeem-code-delivery', [
            'order' => $this->order,
            'codes' => $this->codes,
            'guideUrl' => url('/api/guides/shop2game-freefire'),
        ])->render();

        $rendered = $renderer->render(
            'redeem_code_delivery',
            $context,
            'Votre recharge Free Fire est prête',
            $fallbackHtml
        );

        return $this->subject($rendered['subject'])
            ->html($rendered['html'] ?? $fallbackHtml);
    }
}
