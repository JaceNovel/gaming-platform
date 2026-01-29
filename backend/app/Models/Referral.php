<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Referral extends Model
{
    protected $fillable = [
        'referrer_id',
        'referred_id',
        'commission_earned',
        'commission_rate',
        'commission_base_amount',
        'rewarded_at',
    ];

    protected $casts = [
        'commission_earned' => 'decimal:2',
        'commission_rate' => 'decimal:4',
        'commission_base_amount' => 'decimal:2',
        'rewarded_at' => 'datetime',
    ];

    public function referrer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referrer_id');
    }

    public function referred(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referred_id');
    }
}
