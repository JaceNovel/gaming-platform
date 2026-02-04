<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketplaceCommissionRule extends Model
{
    protected $fillable = [
        'category_id',
        'mode',
        'fixed_amount',
        'percent',
        'is_active',
    ];

    protected $casts = [
        'fixed_amount' => 'decimal:2',
        'percent' => 'decimal:4',
        'is_active' => 'boolean',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function computeCommission(float $price): float
    {
        if (!$this->is_active) {
            return 0.0;
        }

        if ($this->mode === 'percent') {
            $pct = (float) ($this->percent ?? 0);
            return round(($price * $pct) / 100.0, 2);
        }

        return (float) ($this->fixed_amount ?? 0);
    }
}
