<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Game extends Model
{
    use HasFactory;
    protected $fillable = [
        'name',
        'slug',
        'description',
        'image',
        'icon',
        'category',
        'is_active',
        'sort_order',
        'enabled_for_recharge',
        'enabled_for_subscription',
        'enabled_for_marketplace',
    ];
}
