<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GameAccount extends Model
{
    protected $fillable = [
        'game_id',
        'account_details',
        'is_sold',
        'sold_at',
    ];

    protected $casts = [
        'account_details' => 'array',
        'sold_at' => 'datetime',
    ];

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }
}
