<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Coupon extends Model
{
    protected $fillable = [
        'name',
        'code',
        'description',
        'type',
        'discount_percent',
        'discount_value',
        'max_uses',
        'uses_count',
        'starts_at',
        'ends_at',
        'expires_at',
        'is_active',
    ];

    protected $casts = [
        'discount_percent' => 'decimal:2',
        'discount_value' => 'decimal:2',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'expires_at' => 'datetime',
    ];
}
