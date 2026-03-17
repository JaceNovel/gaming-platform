<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    use HasFactory;

    public const STATUS_AWAITING_PAYMENT = 'awaiting_payment';
    public const STATUS_PAYMENT_PROCESSING = 'payment_processing';
    public const STATUS_PAYMENT_SUCCESS = 'payment_success';
    public const STATUS_PAYMENT_FAILED = 'payment_failed';
    public const SUPPLIER_STATUS_PENDING = 'pending';
    public const SUPPLIER_STATUS_PAID = 'paid';
    public const SUPPLIER_STATUS_GROUPING = 'grouping';
    public const SUPPLIER_STATUS_SUPPLIER_ORDERED = 'supplier_ordered';
    public const SUPPLIER_STATUS_WAREHOUSE_RECEIVED = 'warehouse_received';
    public const SUPPLIER_STATUS_DELIVERING = 'delivering';
    public const SUPPLIER_STATUS_DELIVERED = 'delivered';
    public const SUPPLIER_MODE_DBS = 'dbs';
    public const SUPPLIER_MODE_PLATFORM_LOGISTICS = 'platform_logistics';
    public const SUPPLIER_MODE_LOCAL2LOCAL = 'local2local';
    public const SUPPLIER_MODE_LOCAL2LOCAL_SELF_PICKUP = 'local2local_self_pickup';
    public const SUPPLIER_MODE_LOCAL2LOCAL_OFFLINE = 'local2local_offline';

    protected $fillable = [
        'user_id',
        'type',
        'status',
        'supplier_fulfillment_status',
        'supplier_platform',
        'supplier_account_id',
        'supplier_external_order_id',
        'supplier_shipping_mode',
        'supplier_package_id',
        'supplier_tracking_number',
        'supplier_shipping_provider_code',
        'supplier_shipping_provider_name',
        'supplier_document_url',
        'supplier_country_code',
        'supplier_receiving_address_id',
        'grouping_released_at',
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
        'refunded_amount',
        'status_refund',
        'refunded_at',
        'payment_id',
        'items',
        'meta',
        'reference',
    ];

    protected $casts = [
        'total_price' => 'decimal:2',
        'refunded_amount' => 'decimal:2',
        'items' => 'array',
        'meta' => 'array',
        'grouping_released_at' => 'datetime',
        'shipping_estimated_date' => 'datetime',
        'delivered_at' => 'datetime',
        'refunded_at' => 'datetime',
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

    public function supplierAccount(): BelongsTo
    {
        return $this->belongsTo(SupplierAccount::class);
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function supplierFulfillments(): HasMany
    {
        return $this->hasMany(OrderSupplierFulfillment::class);
    }

    public function currentSupplierFulfillment(): HasOne
    {
        return $this->hasOne(OrderSupplierFulfillment::class)->where('platform', 'aliexpress');
    }

    public function redeemItems(): HasMany
    {
        return $this->orderItems()->whereNotNull('redeem_denomination_id');
    }

    public function redeemCodeDeliveries(): HasMany
    {
        return $this->hasMany(RedeemCodeDelivery::class);
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class);
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
                    || !empty($product->redeem_sku)
                    || strtolower((string) ($product->type ?? '')) === 'redeem'
                    || $product->redeemDenominations()->where('active', true)->exists()
                );
            });
        }

        return $this->orderItems()
            ->whereNotNull('redeem_denomination_id')
            ->orWhereHas('product', function ($query) {
                $query->where('stock_mode', 'redeem_pool')
                    ->orWhere('redeem_code_delivery', true)
                    ->orWhereNotNull('redeem_sku')
                    ->orWhere('type', 'redeem')
                    ->orWhereHas('redeemDenominations', function ($q) {
                        $q->where('active', true);
                    });
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
        return in_array((string) $this->status, [self::STATUS_PAYMENT_PROCESSING, self::STATUS_AWAITING_PAYMENT], true);
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
