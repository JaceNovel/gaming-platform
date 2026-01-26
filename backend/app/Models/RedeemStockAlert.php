<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RedeemStockAlert extends Model
{
    protected $fillable = [
        'denomination_id',
        'last_notified_stock',
        'last_notified_at',
        'channel',
    ];

    protected $casts = [
        'last_notified_at' => 'datetime',
    ];

    public function denomination(): BelongsTo
    {
        return $this->belongsTo(RedeemDenomination::class, 'denomination_id');
    }
}
