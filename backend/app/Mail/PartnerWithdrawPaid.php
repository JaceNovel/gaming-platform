<?php

namespace App\Mail;

use App\Models\PartnerWithdrawRequest;
use App\Models\SiteSetting;
use App\Services\EmailTemplateRenderer;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class PartnerWithdrawPaid extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public PartnerWithdrawRequest $withdrawRequest)
    {
    }

    public function build(): self
    {
        $logo = SiteSetting::where('key', 'logo')->value('value');

        $fallbackHtml = view('emails.partner_withdraw_paid', [
            'withdraw' => $this->withdrawRequest,
            'seller' => $this->withdrawRequest->seller,
            'logo' => $logo,
        ])->render();

        $renderer = app(EmailTemplateRenderer::class);

        $context = [
            'withdraw' => $this->withdrawRequest->toArray(),
            'seller' => $this->withdrawRequest->seller?->toArray() ?? [],
            'user' => $this->withdrawRequest->seller?->user?->toArray() ?? [],
        ];

        $rendered = $renderer->render(
            'partner_withdraw_paid',
            $context,
            'Retrait payé - DB Partner',
            $fallbackHtml
        );

        return $this->subject($rendered['subject'])
            ->html($rendered['html'] ?? $fallbackHtml);
    }
}
