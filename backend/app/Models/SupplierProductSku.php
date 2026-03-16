<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupplierProductSku extends Model
{
    use HasFactory;

    protected $fillable = [
        'supplier_product_id',
        'external_sku_id',
        'sku_label',
        'variant_attributes_json',
        'moq',
        'unit_price',
        'currency_code',
        'shipping_template_json',
        'weight_grams',
        'dimensions_json',
        'available_quantity',
        'lead_time_days',
        'logistics_modes_json',
        'sku_payload_json',
        'is_active',
    ];

    protected $casts = [
        'variant_attributes_json' => 'array',
        'shipping_template_json' => 'array',
        'dimensions_json' => 'array',
        'logistics_modes_json' => 'array',
        'sku_payload_json' => 'array',
        'unit_price' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function supplierProduct(): BelongsTo
    {
        return $this->belongsTo(SupplierProduct::class);
    }

    public function productSupplierLinks(): HasMany
    {
        return $this->hasMany(ProductSupplierLink::class);
    }
}