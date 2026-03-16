<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplierSyncRun extends Model
{
    use HasFactory;

    protected $fillable = [
        'supplier_account_id',
        'job_type',
        'status',
        'started_at',
        'finished_at',
        'meta_json',
        'error_message',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
        'meta_json' => 'array',
    ];

    public function supplierAccount(): BelongsTo
    {
        return $this->belongsTo(SupplierAccount::class);
    }
}