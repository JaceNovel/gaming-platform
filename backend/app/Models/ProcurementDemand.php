<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProcurementDemand extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'order_item_id',
        'product_id',
        'product_supplier_link_id',
        'supplier_product_sku_id',
        'quantity_requested',
        'quantity_allocated_from_stock',
        'quantity_to_procure',
        'status',
        'trigger_reason',
        'needed_by_date',
        'batch_locked_at',
    ];

    protected $casts = [
        'needed_by_date' => 'date',
        'batch_locked_at' => 'datetime',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function productSupplierLink(): BelongsTo
    {
        return $this->belongsTo(ProductSupplierLink::class);
    }

    public function supplierProductSku(): BelongsTo
    {
        return $this->belongsTo(SupplierProductSku::class);
    }

    public function batchCoverages(): HasMany
    {
        return $this->hasMany(ProcurementBatchDemand::class);
    }
}