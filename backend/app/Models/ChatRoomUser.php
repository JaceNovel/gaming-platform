<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Support\Carbon;

class ChatRoomUser extends Model
{
    protected $table = 'chat_room_user';

    protected $fillable = [
        'room_id',
        'user_id',
        'role',
        'muted_until',
        'banned_until',
        'message_count',
    ];

    protected $casts = [
        'muted_until' => 'datetime',
        'banned_until' => 'datetime',
    ];

    public function room(): BelongsTo
    {
        return $this->belongsTo(ChatRoom::class, 'room_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isMuted(): bool
    {
        return $this->muted_until instanceof Carbon && $this->muted_until->isFuture();
    }

    public function isBanned(): bool
    {
        return $this->banned_until instanceof Carbon && $this->banned_until->isFuture();
    }
}
