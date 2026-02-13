<?php

namespace App\Models;

use App\Jobs\SendUserWebPushNotification;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Notification extends Model
{
    protected $fillable = [
        'user_id',
        'type',
        'message',
        'is_read',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected static function booted(): void
    {
        static::created(function (self $notification) {
            try {
                SendUserWebPushNotification::dispatch(notificationId: (int) $notification->id)->afterCommit();
            } catch (\Throwable) {
                // best-effort
            }
        });
    }
}
