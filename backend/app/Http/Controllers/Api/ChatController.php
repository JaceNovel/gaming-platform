<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\ChatRoom;
use App\Models\ChatRoomUser;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ChatController extends Controller
{
    private const MAX_PAGE_SIZE = 50;

    public function rooms(Request $request)
    {
        $user = $request->user();

        // Ensure there is always at least one global room available.
        ChatRoom::firstOrCreate(['type' => 'global', 'name' => 'Global']);

        $rooms = ChatRoom::where('is_active', true)
            ->withCount('messages')
            ->orderByRaw("FIELD(type, 'global', 'group')")
            ->orderBy('name')
            ->get()
            ->map(function (ChatRoom $room) use ($user) {
                $membership = $user
                    ? $room->members()->where('user_id', $user->id)->first()
                    : null;

                return [
                    'id' => $room->id,
                    'name' => $room->name,
                    'type' => $room->type,
                    'is_active' => $room->is_active,
                    'messages_count' => $room->messages_count,
                    'member' => $membership ? [
                        'role' => $membership->role,
                        'muted_until' => $membership->muted_until,
                        'banned_until' => $membership->banned_until,
                    ] : null,
                ];
            });

        return response()->json($rooms);
    }

    public function messages(ChatRoom $room, Request $request)
    {
        $user = $request->user();
        $membership = $this->ensureMembership($room, $user);

        if ($membership && $membership->isBanned()) {
            return response()->json(['message' => 'Vous êtes banni de ce salon'], 403);
        }

        $perPage = min(self::MAX_PAGE_SIZE, max(1, $request->integer('per_page', 30)));

        $messages = $room->messages()
            ->where('is_deleted', false)
            ->with(['user' => function ($query) {
                $query->select('id', 'name', 'game_username', 'is_premium', 'premium_level', 'premium_expiration', 'role')
                    ->withCount('premiumMemberships');
            }])
            ->orderByDesc('id')
            ->paginate($perPage);

        $messages->setCollection(
            $messages->getCollection()->map(fn (ChatMessage $message) => $this->transformMessage($message))
        );

        return response()->json($messages);
    }

    public function sendMessage(Request $request)
    {
        $data = $request->validate([
            'room_id' => 'required|exists:chat_rooms,id',
            'message' => 'required|string|max:500',
        ]);

        $room = ChatRoom::findOrFail($data['room_id']);

        if (!$room->is_active) {
            return response()->json(['message' => 'Room is not active'], 403);
        }

        $membership = $this->ensureMembership($room, $request->user());

        if ($membership && $membership->isBanned()) {
            return response()->json(['message' => 'Vous êtes banni de ce salon'], 403);
        }

        if ($membership && $membership->isMuted()) {
            return response()->json(['message' => 'Vous êtes actuellement en mode muet'], 403);
        }

        $mentionedUsers = $this->extractMentionedUsers($data['message']);

        $message = ChatMessage::create([
            'room_id' => $room->id,
            'user_id' => $request->user()->id,
            'message' => $data['message'],
            'mentions' => $mentionedUsers->pluck('id')->values()->all(),
            'is_deleted' => false,
        ]);

        if ($membership) {
            $membership->increment('message_count');
        }

        $this->notifyMentionedUsers($mentionedUsers, $request->user(), $room, $data['message']);

        $message->load(['user' => function ($query) {
            $query->select('id', 'name', 'game_username', 'is_premium', 'premium_level', 'premium_expiration', 'role')
                ->withCount('premiumMemberships');
        }]);

        return response()->json($this->transformMessage($message), 201);
    }

    public function stream(ChatRoom $room, Request $request): StreamedResponse
    {
        $user = $this->authenticateStream($request);
        if (!$user) {
            abort(401, 'Authentification requise');
        }
        $membership = $this->ensureMembership($room, $user);

        if ($membership && $membership->isBanned()) {
            abort(403, 'Vous êtes banni de ce salon');
        }

        $lastId = $request->integer('last_id', 0);

        $response = new StreamedResponse(function () use ($room, $lastId) {
            $cursor = $lastId;

            while (connection_aborted() === 0) {
                $newMessages = ChatMessage::where('room_id', $room->id)
                    ->where('id', '>', $cursor)
                    ->where('is_deleted', false)
                    ->with(['user' => function ($query) {
                        $query->select('id', 'name', 'game_username', 'is_premium', 'premium_level', 'premium_expiration', 'role')
                            ->withCount('premiumMemberships');
                    }])
                    ->orderBy('id')
                    ->limit(50)
                    ->get();

                foreach ($newMessages as $message) {
                    $payload = $this->transformMessage($message);
                    echo "event: message\n";
                    echo 'data: ' . json_encode($payload) . "\n\n";
                    @ob_flush();
                    @flush();
                    $cursor = $message->id;
                }

                sleep(2);
            }
        });

        $response->headers->set('Content-Type', 'text/event-stream');
        $response->headers->set('Cache-Control', 'no-cache, must-revalidate');
        $response->headers->set('Connection', 'keep-alive');

        return $response;
    }

    public function deleteMessage(ChatMessage $message, Request $request)
    {
        $user = $request->user();
        $isOwner = $message->user_id === $user->id;
        $isAdmin = $user->role === 'admin';

        if (!$isOwner && !$isAdmin) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $message->update(['is_deleted' => true]);

        return response()->json(['status' => 'deleted']);
    }

    public function muteUser(ChatRoom $room, Request $request)
    {
        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'minutes' => 'nullable|integer|min:1|max:4320',
        ]);

        $duration = $data['minutes'] ?? 15;
        $mutedUntil = Carbon::now()->addMinutes($duration);

        $membership = ChatRoomUser::firstOrCreate(
            ['room_id' => $room->id, 'user_id' => $data['user_id']],
            ['role' => 'member']
        );

        $membership->muted_until = $mutedUntil;
        $membership->save();

        return response()->json([
            'user_id' => $membership->user_id,
            'muted_until' => $membership->muted_until,
        ]);
    }

    public function banUser(ChatRoom $room, Request $request)
    {
        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'minutes' => 'nullable|integer|min:5|max:10080',
        ]);

        $duration = $data['minutes'] ?? 60;
        $bannedUntil = Carbon::now()->addMinutes($duration);

        $membership = ChatRoomUser::firstOrCreate(
            ['room_id' => $room->id, 'user_id' => $data['user_id']],
            ['role' => 'member']
        );

        $membership->banned_until = $bannedUntil;
        $membership->save();

        return response()->json([
            'user_id' => $membership->user_id,
            'banned_until' => $membership->banned_until,
        ]);
    }

    private function ensureMembership(ChatRoom $room, ?User $user): ?ChatRoomUser
    {
        if (!$user) {
            return null;
        }

        return ChatRoomUser::firstOrCreate(
            ['room_id' => $room->id, 'user_id' => $user->id],
            ['role' => $user->role === 'admin' ? 'admin' : 'member']
        );
    }

    private function extractMentionedUsers(string $message)
    {
        preg_match_all('/@([A-Za-z0-9_\.]+)/', $message, $matches);
        $usernames = collect($matches[1] ?? [])->filter()->unique()->take(20);

        if ($usernames->isEmpty()) {
            return collect();
        }

        return User::whereIn('game_username', $usernames)
            ->orWhereIn('name', $usernames)
            ->get();
    }

    private function notifyMentionedUsers($mentionedUsers, User $author, ChatRoom $room, string $content): void
    {
        foreach ($mentionedUsers as $mentionedUser) {
            Notification::create([
                'user_id' => $mentionedUser->id,
                'type' => 'chat_mention',
                'message' => sprintf(
                    '%s vous a mentionné dans %s : %s',
                    $author->game_username ?? $author->name,
                    $room->name,
                    Str::limit($content, 80)
                ),
                'is_read' => false,
            ]);
        }
    }

    private function transformMessage(ChatMessage $message): array
    {
        $user = $message->user;

        $premiumColor = $this->premiumColor($user);

        return [
            'id' => $message->id,
            'room_id' => $message->room_id,
            'message' => $message->message,
            'mentions' => $message->mentions ?? [],
            'created_at' => $message->created_at,
            'user' => $user ? [
                'id' => $user->id,
                'name' => $user->name,
                'game_username' => $user->game_username,
                'is_premium' => $user->is_premium,
                'premium_level' => $user->premium_level,
                'premium_expiration' => $user->premium_expiration,
                'premium_color' => $premiumColor,
                'premium_badge' => (bool) $user->is_premium,
                'premium_renewals' => $user->premium_memberships_count ?? 0,
                'role' => $user->role,
            ] : null,
        ];
    }

    private function premiumColor(?User $user): string
    {
        if (!$user || !$user->is_premium) {
            return '#e5e7eb';
        }

        return match ((int) ($user->premium_level ?? 1)) {
            3 => '#f59e0b', // gold
            2 => '#06b6d4', // cyan
            default => '#60a5fa', // blue
        };
    }

    private function authenticateStream(Request $request): ?User
    {
        $tokenValue = $request->bearerToken() ?: $request->query('token');

        if ($tokenValue) {
            $accessToken = PersonalAccessToken::findToken($tokenValue);
            if ($accessToken) {
                Auth::setUser($accessToken->tokenable);
            }
        }

        return $request->user();
    }
}
