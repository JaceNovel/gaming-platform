<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProcurementBatch extends Model
{
    use HasFactory;

    protected $fillable = [
        'supplier_account_id',
        'batch_number',
        'status',
        'currency_code',
        'warehouse_destination_label',
        'warehouse_address_json',
        'grouping_key',
        'supplier_order_reference',
        'supplier_order_payload_json',
        'submitted_at',
        'expected_ship_date',
        'expected_arrival_date',
        'notes',
        'created_by',
        'approved_by',
    ];

    protected $casts = [
        'warehouse_address_json' => 'array',
        'supplier_order_payload_json' => 'array',
        'submitted_at' => 'datetime',
        'expected_ship_date' => 'date',
        'expected_arrival_date' => 'date',
    ];

    public function supplierAccount(): BelongsTo
    {
        return $this->belongsTo(SupplierAccount::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ProcurementBatchItem::class);
    }

    public function inboundShipments(): HasMany
    {
        return $this->hasMany(InboundShipment::class);
    }
}