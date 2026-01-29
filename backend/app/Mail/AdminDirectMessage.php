<?php

namespace App\Mail;

use App\Models\SiteSetting;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AdminDirectMessage extends Mailable
{
    use Queueable, SerializesModels;

    public string $subjectLine;
    public string $messageBody;
    public ?string $adminName;
    public ?string $logo;

    public function __construct(string $subjectLine, string $messageBody, ?string $adminName = null)
    {
        $this->subjectLine = $subjectLine;
        $this->messageBody = $messageBody;
        $this->adminName = $adminName;
        $this->logo = SiteSetting::where('key', 'logo')->value('value');
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->subjectLine);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.admin_direct_message',
            with: [
                'subjectLine' => $this->subjectLine,
                'messageBody' => $this->messageBody,
                'adminName' => $this->adminName,
                'logo' => $this->logo,
            ]
        );
    }
}
