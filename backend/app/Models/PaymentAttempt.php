<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class PaymentAttempt extends Model
{
    use HasFactory;

    protected $fillable = [
        'transaction_id',
        'order_id',
        'amount',
        'currency',
        'status',
        'provider',
        'raw_payload',
        'processed_at',
    ];

    protected $casts = [
        'raw_payload' => 'array',
        'processed_at' => 'datetime',
    ];
}
