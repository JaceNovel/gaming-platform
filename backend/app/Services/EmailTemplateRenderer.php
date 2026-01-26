<?php

namespace App\Services;

use App\Models\EmailTemplate;
use Illuminate\Support\Arr;

class EmailTemplateRenderer
{
    public function render(string $key, array $context, string $fallbackSubject, ?string $fallbackHtml = null): array
    {
        $template = EmailTemplate::where('key', $key)->where('is_active', true)->first();

        if (!$template) {
            return [
                'subject' => $fallbackSubject,
                'html' => $fallbackHtml,
                'used_template' => false,
            ];
        }

        $flat = $this->flattenContext($context);
        $replacements = [];
        foreach ($flat as $dotKey => $value) {
            $replacements['{{' . $dotKey . '}}'] = is_scalar($value) ? (string) $value : '';
        }

        $subject = strtr($template->subject, $replacements);
        $body = strtr($template->body, $replacements);

        return [
            'subject' => $subject,
            'html' => $body,
            'used_template' => true,
        ];
    }

    private function flattenContext(array $context): array
    {
        return Arr::dot($context);
    }
}
