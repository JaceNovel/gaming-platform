<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ChatRoom extends Model
{
    protected $fillable = [
        'name',
        'type',
        'is_active',
    ];

    public function messages(): HasMany
    {
        return $this->hasMany(ChatMessage::class);
    }

    public function members(): HasMany
    {
        return $this->hasMany(ChatRoomUser::class, 'room_id');
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'chat_room_user', 'room_id', 'user_id')
            ->withPivot(['role', 'muted_until', 'banned_until', 'message_count'])
            ->withTimestamps();
    }
}
