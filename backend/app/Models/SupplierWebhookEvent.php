<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplierWebhookEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'supplier_account_id',
        'platform',
        'event_type',
        'external_event_id',
        'signature_valid',
        'headers_json',
        'payload_json',
        'processed_at',
        'processing_status',
        'processing_error',
    ];

    protected $casts = [
        'signature_valid' => 'boolean',
        'headers_json' => 'array',
        'payload_json' => 'array',
        'processed_at' => 'datetime',
    ];

    public function supplierAccount(): BelongsTo
    {
        return $this->belongsTo(SupplierAccount::class);
    }
}