<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    public const STATUS_PAYMENT_PROCESSING = 'payment_processing';
    public const STATUS_PAYMENT_SUCCESS = 'payment_success';
    public const STATUS_PAYMENT_FAILED = 'payment_failed';

    protected $fillable = [
        'user_id',
        'type',
        'status',
        'shipping_status',
        'shipping_eta_days',
        'shipping_estimated_date',
        'shipping_document_path',
        'delivered_at',
        'shipping_address_line1',
        'shipping_city',
        'shipping_country_code',
        'shipping_phone',
        'total_price',
        'payment_id',
        'items',
        'meta',
        'reference',
    ];

    protected $casts = [
        'total_price' => 'decimal:2',
        'items' => 'array',
        'meta' => 'array',
        'shipping_estimated_date' => 'datetime',
        'delivered_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function redeemItems(): HasMany
    {
        return $this->orderItems()->whereNotNull('redeem_denomination_id');
    }

    public function redeemCodeDeliveries(): HasMany
    {
        return $this->hasMany(RedeemCodeDelivery::class);
    }

    public function requiresRedeemFulfillment(): bool
    {
        if ($this->relationLoaded('orderItems')) {
            return $this->orderItems->contains(function ($item) {
                if (!empty($item->redeem_denomination_id)) {
                    return true;
                }

                $product = $item->product;
                if (!$product) {
                    return false;
                }

                return (
                    (string) ($product->stock_mode ?? '') === 'redeem_pool'
                    || (bool) ($product->redeem_code_delivery ?? false)
                    || strtolower((string) ($product->type ?? '')) === 'redeem'
                );
            });
        }

        return $this->orderItems()
            ->whereNotNull('redeem_denomination_id')
            ->orWhereHas('product', function ($query) {
                $query->where('stock_mode', 'redeem_pool')
                    ->orWhere('redeem_code_delivery', true)
                    ->orWhere('type', 'redeem');
            })
            ->exists();
    }

    public function hasPhysicalItems(): bool
    {
        if ($this->relationLoaded('orderItems')) {
            return $this->orderItems->contains(function ($item) {
                return (bool) ($item->is_physical ?? false) || (bool) ($item->product?->shipping_required ?? false);
            });
        }

        return $this->orderItems()->where('is_physical', true)->exists();
    }

    public function isPaymentProcessing(): bool
    {
        return (string) $this->status === self::STATUS_PAYMENT_PROCESSING;
    }

    public function isPaymentSuccess(): bool
    {
        return (string) $this->status === self::STATUS_PAYMENT_SUCCESS;
    }

    public function isPaymentFailed(): bool
    {
        return (string) $this->status === self::STATUS_PAYMENT_FAILED;
    }

    public function canBeFulfilled(): bool
    {
        return $this->isPaymentSuccess();
    }
}
