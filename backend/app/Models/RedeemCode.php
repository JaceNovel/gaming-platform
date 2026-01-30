<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RedeemCode extends Model
{
    use HasFactory;

    protected $fillable = [
        'denomination_id',
        'lot_id',
        'code',
        'status',
        'reserved_until',
        'assigned_order_id',
        'assigned_user_id',
        'assigned_at',
        'sent_at',
        'revealed_at',
        'last_resend_at',
        'imported_by',
        'imported_at',
        'meta',
    ];

    protected $casts = [
        'reserved_until' => 'datetime',
        'assigned_at' => 'datetime',
        'sent_at' => 'datetime',
        'revealed_at' => 'datetime',
        'last_resend_at' => 'datetime',
        'imported_at' => 'datetime',
        'meta' => 'array',
    ];

    public function denomination(): BelongsTo
    {
        return $this->belongsTo(RedeemDenomination::class, 'denomination_id');
    }

    public function lot(): BelongsTo
    {
        return $this->belongsTo(RedeemLot::class, 'lot_id');
    }

    public function assignedOrder(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'assigned_order_id');
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function importer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'imported_by');
    }
}
