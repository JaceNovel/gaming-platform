<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasFactory;
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
}
