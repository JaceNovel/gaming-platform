<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;

class NotificationService
{
    public function broadcast(string $type, string $message): void
    {
        $now = now();
        User::query()->select('id')->chunkById(500, function ($users) use ($type, $message, $now) {
            $rows = [];
            foreach ($users as $user) {
                $rows[] = [
                    'user_id' => $user->id,
                    'type' => $type,
                    'message' => $message,
                    'is_read' => false,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            if (!empty($rows)) {
                Notification::insert($rows);
            }
        });
    }

    public function notifyUser(int $userId, string $type, string $message): void
    {
        Notification::create([
            'user_id' => $userId,
            'type' => $type,
            'message' => $message,
            'is_read' => false,
        ]);
    }
}
