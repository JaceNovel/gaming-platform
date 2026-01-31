<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentEvent extends Model
{
    protected $fillable = [
        'provider',
        'tx_id',
        'event',
        'status',
        'order_id',
        'payload_hash',
        'payload',
        'received_at',
        'processed_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'received_at' => 'datetime',
        'processed_at' => 'datetime',
    ];
}
