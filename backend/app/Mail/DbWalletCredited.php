<?php

namespace App\Mail;

use App\Models\SiteSetting;
use App\Models\WalletAccount;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class DbWalletCredited extends Mailable
{
    use Queueable, SerializesModels;

    public WalletAccount $wallet;
    public float $amount;
    public string $reference;
    public string $reason;
    public ?string $logo;

    public function __construct(WalletAccount $wallet, float $amount, string $reference, string $reason = '')
    {
        $this->wallet = $wallet;
        $this->amount = $amount;
        $this->reference = $reference;
        $this->reason = $reason;
        $this->logo = SiteSetting::where('key', 'logo')->value('value');
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'DBWallet crédité - BADBOYSHOP'
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.dbwallet_credited',
            with: [
                'wallet' => $this->wallet,
                'amount' => $this->amount,
                'reference' => $this->reference,
                'reason' => $this->reason,
                'logo' => $this->logo,
            ]
        );
    }
}
