<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PremiumMembership extends Model
{
    protected $fillable = [
        'user_id',
        'level',
        'game_id',
        'game_username',
        'expiration_date',
        'is_active',
        'renewal_count',
    ];

    protected $casts = [
        'expiration_date' => 'date',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }
}
