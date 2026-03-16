<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InboundShipment extends Model
{
    use HasFactory;

    protected $fillable = [
        'procurement_batch_id',
        'shipment_reference',
        'carrier_name',
        'tracking_number',
        'tracking_url',
        'status',
        'shipped_at',
        'arrived_at',
        'received_at',
        'shipment_payload_json',
    ];

    protected $casts = [
        'shipped_at' => 'datetime',
        'arrived_at' => 'datetime',
        'received_at' => 'datetime',
        'shipment_payload_json' => 'array',
    ];

    public function procurementBatch(): BelongsTo
    {
        return $this->belongsTo(ProcurementBatch::class);
    }

    public function receipts(): HasMany
    {
        return $this->hasMany(WarehouseReceipt::class);
    }
}