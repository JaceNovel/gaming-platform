<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class PartnerWallet extends Model
{
    protected $fillable = [
        'seller_id',
        'currency',
        'available_balance',
        'pending_balance',
        'reserved_withdraw_balance',
        'status',
        'status_reason',
        'frozen_at',
    ];

    protected $casts = [
        'available_balance' => 'decimal:2',
        'pending_balance' => 'decimal:2',
        'reserved_withdraw_balance' => 'decimal:2',
        'frozen_at' => 'datetime',
    ];

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(PartnerWalletTransaction::class);
    }

    public function withdrawRequests(): HasMany
    {
        return $this->hasMany(PartnerWithdrawRequest::class);
    }

    public function latestWithdrawRequest(): HasOne
    {
        return $this->hasOne(PartnerWithdrawRequest::class)->latestOfMany();
    }

    public function isFrozen(): bool
    {
        return $this->status === 'frozen';
    }
}
