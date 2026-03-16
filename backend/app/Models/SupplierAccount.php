<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupplierAccount extends Model
{
    use HasFactory;

    protected $fillable = [
        'platform',
        'label',
        'member_id',
        'resource_owner',
        'app_key',
        'app_secret',
        'access_token',
        'refresh_token',
        'access_token_expires_at',
        'refresh_token_expires_at',
        'scopes_json',
        'country_code',
        'currency_code',
        'is_active',
        'last_sync_at',
        'last_error_at',
        'last_error_message',
    ];

    protected $hidden = [
        'app_secret',
        'access_token',
        'refresh_token',
    ];

    protected $casts = [
        'app_secret' => 'encrypted',
        'access_token' => 'encrypted',
        'refresh_token' => 'encrypted',
        'scopes_json' => 'array',
        'is_active' => 'boolean',
        'access_token_expires_at' => 'datetime',
        'refresh_token_expires_at' => 'datetime',
        'last_sync_at' => 'datetime',
        'last_error_at' => 'datetime',
    ];

    public function supplierProducts(): HasMany
    {
        return $this->hasMany(SupplierProduct::class);
    }

    public function procurementBatches(): HasMany
    {
        return $this->hasMany(ProcurementBatch::class);
    }

    public function webhookEvents(): HasMany
    {
        return $this->hasMany(SupplierWebhookEvent::class);
    }

    public function syncRuns(): HasMany
    {
        return $this->hasMany(SupplierSyncRun::class);
    }
}