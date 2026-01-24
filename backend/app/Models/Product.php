<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
        'price',
        'discount_price',
        'old_price',
        'discount_percent',
        'deal_type',
        'stock_type',
        'delivery_eta_days',
        'purchases_count',
        'cart_adds_count',
        'rating_avg',
        'rating_count',
        'sold_count',
        'stock',
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
}
