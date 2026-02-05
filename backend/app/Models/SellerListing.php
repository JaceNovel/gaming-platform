<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SellerListing extends Model
{
    protected $fillable = [
        'seller_id',
        'game_id',
        'category_id',
        'title',
        'description',
        'price',
        'currency',
        'account_level',
        'account_rank',
        'account_region',
        'has_email_access',
        'delivery_window_hours',
        'status',
        'status_reason',
        'submitted_at',
        'reviewed_at',
        'reviewed_by',
        'approved_at',
        'rejected_at',
        'suspended_at',
        'order_id',
        'reserved_order_id',
        'reserved_until',
        'sold_at',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'has_email_access' => 'boolean',
        'delivery_window_hours' => 'integer',
        'reserved_until' => 'datetime',
        'sold_at' => 'datetime',
        'submitted_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
        'suspended_at' => 'datetime',
    ];

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function disputes(): HasMany
    {
        return $this->hasMany(Dispute::class, 'seller_listing_id');
    }

    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }

    public function isPubliclyVisible(): bool
    {
        return $this->isApproved() && !$this->order_id && !$this->sold_at;
    }
}
