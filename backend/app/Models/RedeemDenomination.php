<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RedeemDenomination extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'code',
        'label',
        'diamonds',
        'active',
        'low_stock_threshold',
        'auto_reserve_seconds',
        'meta',
    ];

    protected $casts = [
        'active' => 'boolean',
        'meta' => 'array',
    ];

    protected $appends = [
        'is_low_stock',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function codes(): HasMany
    {
        return $this->hasMany(RedeemCode::class, 'denomination_id');
    }

    public function scopeActive($query)
    {
        return $query->where('active', true);
    }

    public function availableStock(): int
    {
        $attributes = $this->getAttributes();
        if (array_key_exists('available_count', $attributes)) {
            return (int) $attributes['available_count'];
        }

        if (!$this->relationLoaded('codes')) {
            return $this->codes()->where('status', 'available')->count();
        }

        return $this->codes->where('status', 'available')->count();
    }

    public function getIsLowStockAttribute(): bool
    {
        return $this->availableStock() < $this->low_stock_threshold;
    }
}
