<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductSupplierLink extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'supplier_product_sku_id',
        'priority',
        'is_default',
        'procurement_mode',
        'target_moq',
        'reorder_point',
        'reorder_quantity',
        'safety_stock',
        'warehouse_destination_label',
        'expected_inbound_days',
        'pricing_snapshot_json',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'pricing_snapshot_json' => 'array',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function supplierProductSku(): BelongsTo
    {
        return $this->belongsTo(SupplierProductSku::class);
    }

    public function procurementDemands(): HasMany
    {
        return $this->hasMany(ProcurementDemand::class);
    }
}