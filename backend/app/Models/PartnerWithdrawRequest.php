<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PartnerWithdrawRequest extends Model
{
    protected $fillable = [
        'partner_wallet_id',
        'seller_id',
        'amount',
        'status',
        'payout_details',
        'processed_by_admin_id',
        'processed_at',
        'admin_note',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'payout_details' => 'array',
        'processed_at' => 'datetime',
    ];

    public function partnerWallet(): BelongsTo
    {
        return $this->belongsTo(PartnerWallet::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function processedByAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by_admin_id');
    }
}
