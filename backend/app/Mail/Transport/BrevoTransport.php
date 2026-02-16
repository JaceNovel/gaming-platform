<?php

namespace App\Mail\Transport;

use Illuminate\Support\Facades\Http;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\Part\DataPart;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;

class BrevoTransport extends AbstractTransport
{
    public function __construct(
        protected string $apiKey,
        protected string $baseUrl = 'https://api.brevo.com',
        ?EventDispatcherInterface $dispatcher = null,
    ) {
        parent::__construct($dispatcher);
    }

    public function __toString(): string
    {
        return 'brevo';
    }

    protected function doSend(SentMessage $sentMessage): void
    {
        $message = $sentMessage->getOriginalMessage();
        if (!$message instanceof Email) {
            throw new TransportException('Brevo transport only supports Symfony\\Component\\Mime\\Email messages.');
        }

        $from = $this->firstAddress($message->getFrom());
        if (!$from) {
            $fallbackFrom = trim((string) (config('mail.from.address') ?? ''));
            if ($fallbackFrom !== '') {
                $fallbackName = (string) (config('mail.from.name') ?? '');
                $from = new Address($fallbackFrom, $fallbackName);
            }
        }
        if (!$from) {
            throw new TransportException('Brevo transport requires a From address.');
        }

        $to = $this->mapAddresses($message->getTo());
        if (empty($to)) {
            throw new TransportException('Brevo transport requires at least one recipient.');
        }

        $payload = [
            'sender' => [
                'email' => $from->getAddress(),
                'name' => $from->getName() ?: null,
            ],
            'to' => $to,
            'subject' => (string) ($message->getSubject() ?? ''),
        ];

        $cc = $this->mapAddresses($message->getCc());
        if (!empty($cc)) {
            $payload['cc'] = $cc;
        }

        $bcc = $this->mapAddresses($message->getBcc());
        if (!empty($bcc)) {
            $payload['bcc'] = $bcc;
        }

        $replyTo = $this->firstAddress($message->getReplyTo());
        if ($replyTo) {
            $payload['replyTo'] = [
                'email' => $replyTo->getAddress(),
                'name' => $replyTo->getName() ?: null,
            ];
        }

        $html = $message->getHtmlBody();
        $text = $message->getTextBody();

        if (is_string($html) && trim($html) !== '') {
            $payload['htmlContent'] = $html;
        }

        if (is_string($text) && trim($text) !== '') {
            $payload['textContent'] = $text;
        }

        if (!isset($payload['htmlContent']) && !isset($payload['textContent'])) {
            // Fallback: convert empty body to a minimal text to satisfy API.
            $payload['textContent'] = '';
        }

        $attachments = [];
        foreach ($message->getAttachments() as $attachment) {
            if (!$attachment instanceof DataPart) {
                continue;
            }

            $filename = (string) ($attachment->getFilename() ?? 'attachment');
            $body = $attachment->getBody();
            $content = method_exists($body, 'bodyToString') ? $body->bodyToString() : (string) $body;
            if ($content === '') {
                continue;
            }

            $attachments[] = [
                'name' => $filename,
                'content' => base64_encode($content),
            ];
        }

        if (!empty($attachments)) {
            $payload['attachment'] = $attachments;
        }

        $url = rtrim($this->baseUrl, '/') . '/v3/smtp/email';

        $response = Http::timeout(20)
            ->withHeaders([
                'accept' => 'application/json',
                'api-key' => $this->apiKey,
                'content-type' => 'application/json',
            ])
            ->post($url, $payload);

        if (!$response->successful()) {
            $status = $response->status();
            $body = (string) $response->body();
            throw new TransportException("Brevo API send failed (HTTP {$status}): {$body}");
        }
    }

    private function firstAddress(array $addresses): ?Address
    {
        foreach ($addresses as $address) {
            if ($address instanceof Address) {
                return $address;
            }
        }
        return null;
    }

    /**
     * @param Address[] $addresses
     * @return array<int, array{email: string, name?: string}>
     */
    private function mapAddresses(array $addresses): array
    {
        $out = [];
        foreach ($addresses as $address) {
            if (!$address instanceof Address) {
                continue;
            }
            $row = ['email' => $address->getAddress()];
            if ($address->getName() !== '') {
                $row['name'] = $address->getName();
            }
            $out[] = $row;
        }
        return $out;
    }
}
