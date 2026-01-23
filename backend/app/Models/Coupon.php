<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Coupon extends Model
{
    protected $fillable = [
        'code',
        'discount_percent',
        'expires_at',
        'is_active',
    ];

    protected $casts = [
        'discount_percent' => 'decimal:2',
        'expires_at' => 'datetime',
    ];
}
