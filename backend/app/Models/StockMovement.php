<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
{
    protected $fillable = [
        'product_id',
        'redeem_denomination_id',
        'quantity',
        'direction',
        'reason',
        'admin_id',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function denomination(): BelongsTo
    {
        return $this->belongsTo(RedeemDenomination::class, 'redeem_denomination_id');
    }

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id');
    }
}
