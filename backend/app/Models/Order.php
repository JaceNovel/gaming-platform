<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    protected $fillable = [
        'user_id',
        'type',
        'status',
        'total_price',
        'payment_id',
        'items',
        'meta',
        'reference',
    ];

    protected $casts = [
        'total_price' => 'decimal:2',
        'items' => 'array',
        'meta' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function redeemItems(): HasMany
    {
        return $this->orderItems()->whereNotNull('redeem_denomination_id');
    }

    public function requiresRedeemFulfillment(): bool
    {
        if ($this->relationLoaded('orderItems')) {
            return $this->orderItems->contains(fn ($item) => !empty($item->redeem_denomination_id));
        }

        return $this->redeemItems()->exists();
    }
}
