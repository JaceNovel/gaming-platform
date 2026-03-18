<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplierReceivingAddress extends Model
{
    use HasFactory;

    protected $fillable = [
        'supplier_country_id',
        'platform',
        'recipient_name',
        'contact_name',
        'address_line1',
        'address_line2',
        'city',
        'postal_code',
        'phone',
        'shipping_mark',
        'notes',
        'is_active',
        'is_default',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_default' => 'boolean',
    ];

    public function country(): BelongsTo
    {
        return $this->belongsTo(SupplierCountry::class, 'supplier_country_id');
    }
}