<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WalletAccount extends Model
{
    protected $fillable = [
        'wallet_id',
        'user_id',
        'currency',
        'balance',
        'bonus_balance',
        'bonus_expires_at',
        'status',
        'recharge_blocked_at',
        'recharge_blocked_reason',
    ];

    protected $casts = [
        'balance' => 'decimal:2',
        'bonus_balance' => 'decimal:2',
        'bonus_expires_at' => 'datetime',
        'recharge_blocked_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(WalletTransaction::class);
    }

    public function payouts(): HasMany
    {
        return $this->hasMany(Payout::class);
    }
}
