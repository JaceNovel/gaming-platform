<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tournament extends Model
{
    use HasFactory;

    protected $fillable = [
        'game_id',
        'name',
        'slug',
        'status',
        'is_active',
        'is_free',
        'prize_pool_fcfa',
        'entry_fee_fcfa',
        'max_participants',
        'registered_participants',
        'format',
        'starts_at',
        'ends_at',
        'registration_deadline',
        'description',
        'rules',
        'requirements',
        'stream_url',
        'contact_email',
        'image',
        'first_prize_fcfa',
        'second_prize_fcfa',
        'third_prize_fcfa',
        'sponsors',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_free' => 'boolean',
        'prize_pool_fcfa' => 'integer',
        'entry_fee_fcfa' => 'integer',
        'max_participants' => 'integer',
        'registered_participants' => 'integer',
        'first_prize_fcfa' => 'integer',
        'second_prize_fcfa' => 'integer',
        'third_prize_fcfa' => 'integer',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'registration_deadline' => 'datetime',
        'sponsors' => 'array',
    ];

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    public function registrations(): HasMany
    {
        return $this->hasMany(TournamentRegistration::class);
    }
}
