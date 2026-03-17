<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupplierCountry extends Model
{
    use HasFactory;

    protected $fillable = [
        'platform',
        'code',
        'name',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function receivingAddresses(): HasMany
    {
        return $this->hasMany(SupplierReceivingAddress::class);
    }
}