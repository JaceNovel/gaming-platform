<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayoutEvent extends Model
{
    protected $fillable = [
        'payout_id',
        'provider_payload',
        'status',
    ];

    protected $casts = [
        'provider_payload' => 'array',
    ];

    public function payout(): BelongsTo
    {
        return $this->belongsTo(Payout::class);
    }
}
