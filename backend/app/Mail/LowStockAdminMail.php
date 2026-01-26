<?php

namespace App\Mail;

use App\Models\RedeemDenomination;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class LowStockAdminMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public RedeemDenomination $denomination,
        public int $available,
        public int $threshold
    ) {
        $this->subject('⚠️ Stock bas Redeem Codes');
    }

    public function build(): self
    {
        return $this->subject($this->subject)
            ->view('emails.low-stock-admin', [
                'denomination' => $this->denomination,
                'available' => $this->available,
                'threshold' => $this->threshold,
            ]);
    }
}
