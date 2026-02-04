<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Dispute extends Model
{
    protected $fillable = [
        'marketplace_order_id',
        'seller_listing_id',
        'seller_id',
        'buyer_id',
        'status',
        'reason',
        'opened_at',
        'resolved_by_admin_id',
        'resolution',
        'resolution_note',
        'resolved_at',
        'freeze_applied_at',
    ];

    protected $casts = [
        'opened_at' => 'datetime',
        'resolved_at' => 'datetime',
        'freeze_applied_at' => 'datetime',
    ];

    public function listing(): BelongsTo
    {
        return $this->belongsTo(SellerListing::class, 'seller_listing_id');
    }

    public function marketplaceOrder(): BelongsTo
    {
        return $this->belongsTo(MarketplaceOrder::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function resolvedByAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by_admin_id');
    }
}
