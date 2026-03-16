<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProcurementBatchDemand extends Model
{
    use HasFactory;

    protected $table = 'procurement_batch_demand';

    protected $fillable = [
        'procurement_batch_item_id',
        'procurement_demand_id',
        'quantity_covered',
    ];

    public function procurementBatchItem(): BelongsTo
    {
        return $this->belongsTo(ProcurementBatchItem::class);
    }

    public function procurementDemand(): BelongsTo
    {
        return $this->belongsTo(ProcurementDemand::class);
    }
}