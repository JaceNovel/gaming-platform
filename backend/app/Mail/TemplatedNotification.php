<?php

namespace App\Mail;

use App\Models\SiteSetting;
use App\Services\EmailTemplateRenderer;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class TemplatedNotification extends Mailable
{
    use Queueable, SerializesModels;

    public string $templateKey;
    public string $fallbackSubject;
    public array $context;
    public array $templateViewData;

    public function __construct(string $templateKey, string $fallbackSubject, array $context, array $viewData)
    {
        $this->templateKey = $templateKey;
        $this->fallbackSubject = $fallbackSubject;
        $this->context = $context;
        // Don't redeclare/override Mailable::$viewData (Laravel core).
        $this->templateViewData = $viewData;
    }

    public function build(): self
    {
        $logo = SiteSetting::where('key', 'logo')->value('value');

        $fallbackHtml = view('emails.templated_notification', array_merge($this->templateViewData, [
            'logo' => $logo,
        ]))->render();

        $renderer = app(EmailTemplateRenderer::class);
        $rendered = $renderer->render(
            $this->templateKey,
            $this->context,
            $this->fallbackSubject,
            $fallbackHtml
        );

        return $this->subject($rendered['subject'])
            ->html($rendered['html'] ?? $fallbackHtml);
    }
}
