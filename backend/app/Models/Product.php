<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasFactory;

    protected $appends = [
        'estimated_delivery_label',
        'estimated_delivery_minutes',
    ];

    protected $fillable = [
        'game_id',
        'name',
        'title',
        'slug',
        'sku',
        'type',
        'category',
        'category_id',
        'price',
        'discount_price',
        'old_price',
        'discount_percent',
        'deal_type',
        'stock_type',
        'stock_mode',
        'delivery_eta_days',
        'delivery_estimate_label',
        'purchases_count',
        'cart_adds_count',
        'rating_avg',
        'rating_count',
        'sold_count',
        'stock',
        'price_fcfa',
        'redeem_sku',
        'redeem_code_delivery',
        'stock_low_threshold',
        'stock_alert_channel',
        'stock_alert_emails',
        'shipping_required',
        'delivery_type',
        'display_section',
        'is_active',
        'details',
        'description',
    ];

    protected $casts = [
        'details' => 'array',
        'price' => 'decimal:2',
        'discount_price' => 'decimal:2',
        'old_price' => 'decimal:2',
        'rating_avg' => 'decimal:2',
        'price_fcfa' => 'integer',
        'redeem_code_delivery' => 'boolean',
        'stock_low_threshold' => 'integer',
        'shipping_required' => 'boolean',
    ];

    public function images()
    {
        return $this->hasMany(ProductImage::class)->orderBy('position');
    }

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    public function categoryEntity(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    public function likes(): HasMany
    {
        return $this->hasMany(Like::class, 'product_id');
    }

    public function redeemDenominations(): HasMany
    {
        return $this->hasMany(RedeemDenomination::class);
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(ProductTag::class, 'product_tag')->withTimestamps();
    }

    public function getEstimatedDeliveryMinutesAttribute(): ?int
    {
        // Manual override: if ETA days is set, use it.
        if (!empty($this->delivery_eta_days) && is_numeric($this->delivery_eta_days)) {
            $days = (int) $this->delivery_eta_days;
            if ($days > 0) {
                return $days * 24 * 60;
            }
        }

        $type = strtolower((string) ($this->type ?? ''));
        $isRedeemDelivery = (bool) ($this->redeem_code_delivery ?? false)
            || strtolower((string) ($this->stock_mode ?? '')) === 'redeem_pool';

        // Redeem code delivery is instant if in stock.
        if ($isRedeemDelivery) {
            return 0;
        }

        // Physical items: rely on admin-configured ETA (already handled above).
        if ((bool) ($this->shipping_required ?? false)) {
            return null;
        }

        if ($type === 'account') {
            return 24 * 60;
        }

        if ($type === 'subscription') {
            return 2 * 60;
        }

        if (in_array($type, ['recharge', 'topup', 'pass'], true)) {
            $slug = strtolower((string) ($this->game?->slug ?? ''));
            $name = strtolower((string) ($this->game?->name ?? ''));
            // Only Free Fire recharges are instant (automation).
            if ($slug === 'free-fire' || str_contains($slug, 'free') && str_contains($slug, 'fire')
                || str_contains($name, 'free') && str_contains($name, 'fire')) {
                return 0;
            }
            // Other recharges: 2h.
            return 2 * 60;
        }

        return null;
    }

    public function getEstimatedDeliveryLabelAttribute(): ?string
    {
        $minutes = $this->estimated_delivery_minutes;

        if ($minutes === null) {
            return null;
        }

        if ($minutes <= 0) {
            return 'Instantané';
        }

        if ($minutes < 60) {
            return $minutes . ' min';
        }

        if ($minutes % 1440 === 0) {
            $days = (int) ($minutes / 1440);
            return $days . ' jour' . ($days > 1 ? 's' : '');
        }

        if ($minutes % 60 === 0) {
            $hours = (int) ($minutes / 60);
            return $hours . 'h';
        }

        $hours = (int) floor($minutes / 60);
        $rest = $minutes % 60;
        return $hours . 'h ' . $rest . 'm';
    }
}
