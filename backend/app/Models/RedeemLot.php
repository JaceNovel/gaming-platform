<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RedeemLot extends Model
{
    use HasFactory;

    protected $fillable = [
        'denomination_id',
        'code',
        'label',
        'supplier',
        'purchase_price_fcfa',
        'received_at',
        'created_by',
        'meta',
    ];

    protected $casts = [
        'purchase_price_fcfa' => 'integer',
        'received_at' => 'datetime',
        'meta' => 'array',
    ];

    public function denomination(): BelongsTo
    {
        return $this->belongsTo(RedeemDenomination::class, 'denomination_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function codes(): HasMany
    {
        return $this->hasMany(RedeemCode::class, 'lot_id');
    }
}
