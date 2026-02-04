<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerKycFile extends Model
{
    protected $fillable = [
        'seller_id',
        'type',
        'source',
        'disk',
        'path',
        'mime',
        'size',
        'sha256',
    ];

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }
}
