<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupplierCountry extends Model
{
    use HasFactory;

    protected $fillable = [
        'platform',
        'code',
        'name',
        'is_active',
        'storefront_enabled',
        'transit_provider_name',
        'transit_city',
        'currency_code',
        'pricing_rules_json',
        'customer_notice',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'storefront_enabled' => 'boolean',
        'pricing_rules_json' => 'array',
        'sort_order' => 'integer',
    ];

    public function receivingAddresses(): HasMany
    {
        return $this->hasMany(SupplierReceivingAddress::class);
    }
}