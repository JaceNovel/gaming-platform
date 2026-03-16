<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupplierProduct extends Model
{
    use HasFactory;

    protected $fillable = [
        'supplier_account_id',
        'external_product_id',
        'external_offer_id',
        'title',
        'slug',
        'supplier_name',
        'source_url',
        'main_image_url',
        'category_path_json',
        'attributes_json',
        'product_payload_json',
        'status',
        'last_synced_at',
    ];

    protected $casts = [
        'category_path_json' => 'array',
        'attributes_json' => 'array',
        'product_payload_json' => 'array',
        'last_synced_at' => 'datetime',
    ];

    public function supplierAccount(): BelongsTo
    {
        return $this->belongsTo(SupplierAccount::class);
    }

    public function skus(): HasMany
    {
        return $this->hasMany(SupplierProductSku::class);
    }
}