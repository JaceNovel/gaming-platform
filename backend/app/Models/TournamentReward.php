<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TournamentReward extends Model
{
    use HasFactory;

    protected $fillable = [
        'tournament_id',
        'place',
        'user_id',
        'reward_amount_fcfa',
        'min_purchase_amount_fcfa',
        'credited_at',
    ];

    protected $casts = [
        'place' => 'integer',
        'reward_amount_fcfa' => 'integer',
        'min_purchase_amount_fcfa' => 'integer',
        'credited_at' => 'datetime',
    ];

    public function tournament(): BelongsTo
    {
        return $this->belongsTo(Tournament::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
