<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WarehouseReceiptItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'warehouse_receipt_id',
        'procurement_batch_item_id',
        'product_id',
        'supplier_product_sku_id',
        'quantity_received',
        'quantity_damaged',
        'quantity_missing',
        'stock_movement_id',
    ];

    public function warehouseReceipt(): BelongsTo
    {
        return $this->belongsTo(WarehouseReceipt::class);
    }

    public function procurementBatchItem(): BelongsTo
    {
        return $this->belongsTo(ProcurementBatchItem::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function supplierProductSku(): BelongsTo
    {
        return $this->belongsTo(SupplierProductSku::class);
    }

    public function stockMovement(): BelongsTo
    {
        return $this->belongsTo(StockMovement::class);
    }
}