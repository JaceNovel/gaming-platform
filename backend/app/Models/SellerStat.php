<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerStat extends Model
{
    protected $fillable = [
        'seller_id',
        'total_sales',
        'successful_sales',
        'disputed_sales',
        'cancelled_sales',
        'last_sale_at',
    ];

    protected $casts = [
        'last_sale_at' => 'datetime',
    ];

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function successRate(): float
    {
        if ($this->total_sales <= 0) {
            return 0.0;
        }

        return (float) $this->successful_sales / (float) $this->total_sales;
    }
}
