<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketplaceOrder extends Model
{
    protected $fillable = [
        'order_id',
        'seller_listing_id',
        'seller_id',
        'buyer_id',
        'status',
        'price',
        'commission_amount',
        'seller_earnings',
        'delivery_deadline_at',
        'whatsapp_revealed_at',
        'delivered_at',
        'delivery_proof',
        'dispute_id',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'commission_amount' => 'decimal:2',
        'seller_earnings' => 'decimal:2',
        'delivery_deadline_at' => 'datetime',
        'whatsapp_revealed_at' => 'datetime',
        'delivered_at' => 'datetime',
        'delivery_proof' => 'array',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(SellerListing::class, 'seller_listing_id');
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function dispute(): BelongsTo
    {
        return $this->belongsTo(Dispute::class);
    }
}
