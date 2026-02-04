<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Seller extends Model
{
    protected $fillable = [
        'user_id',
        'status',
        'whatsapp_number',
        'kyc_full_name',
        'kyc_dob',
        'kyc_country',
        'kyc_city',
        'kyc_address',
        'kyc_id_type',
        'kyc_id_number',
        'kyc_submitted_at',
        'approved_at',
        'rejected_at',
        'suspended_at',
        'banned_at',
        'status_reason',
        'partner_wallet_frozen',
        'partner_wallet_frozen_at',
    ];

    protected $casts = [
        'kyc_dob' => 'date',
        'kyc_submitted_at' => 'datetime',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
        'suspended_at' => 'datetime',
        'banned_at' => 'datetime',
        'partner_wallet_frozen' => 'boolean',
        'partner_wallet_frozen_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function kycFiles(): HasMany
    {
        return $this->hasMany(SellerKycFile::class);
    }

    public function listings(): HasMany
    {
        return $this->hasMany(SellerListing::class);
    }

    public function stats(): HasOne
    {
        return $this->hasOne(SellerStat::class);
    }

    public function partnerWallet(): HasOne
    {
        return $this->hasOne(PartnerWallet::class);
    }

    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }

    public function isSuspended(): bool
    {
        return $this->status === 'suspended';
    }

    public function isBanned(): bool
    {
        return $this->status === 'banned';
    }

    public function canSell(): bool
    {
        return $this->isApproved() && !$this->partner_wallet_frozen;
    }
}
