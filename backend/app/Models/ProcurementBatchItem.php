<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProcurementBatchItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'procurement_batch_id',
        'supplier_product_sku_id',
        'product_id',
        'product_supplier_link_id',
        'quantity_ordered',
        'unit_price',
        'currency_code',
        'line_total',
        'source_snapshot_json',
    ];

    protected $casts = [
        'unit_price' => 'decimal:2',
        'line_total' => 'decimal:2',
        'source_snapshot_json' => 'array',
    ];

    public function procurementBatch(): BelongsTo
    {
        return $this->belongsTo(ProcurementBatch::class);
    }

    public function supplierProductSku(): BelongsTo
    {
        return $this->belongsTo(SupplierProductSku::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function productSupplierLink(): BelongsTo
    {
        return $this->belongsTo(ProductSupplierLink::class);
    }

    public function demandCoverages(): HasMany
    {
        return $this->hasMany(ProcurementBatchDemand::class);
    }
}