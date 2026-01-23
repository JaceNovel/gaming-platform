<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use Illuminate\Http\Request;

class SupportTicketController extends Controller
{
    public function inbox(Request $request)
    {
        $user = $request->user();
        $limit = min(20, max(1, (int) $request->query('limit', 6)));

        $tickets = SupportTicket::where('user_id', $user->id)
            ->with(['messages' => function ($query) {
                $query->latest()->limit(1);
            }])
            ->orderByDesc('last_message_at')
            ->limit($limit)
            ->get()
            ->map(function (SupportTicket $ticket) use ($user) {
                $lastMessage = $ticket->messages->first();
                $unreadCount = $ticket->messages()
                    ->where('from_admin', true)
                    ->where('is_read', false)
                    ->count();

                return [
                    'id' => $ticket->id,
                    'subject' => $ticket->subject,
                    'status' => $ticket->status,
                    'last_message' => $lastMessage?->body,
                    'last_message_at' => $lastMessage?->created_at,
                    'unread_count' => $unreadCount,
                ];
            });

        $ticketIds = $tickets->pluck('id')->values();
        $totalUnread = $ticketIds->isEmpty()
            ? 0
            : SupportMessage::whereIn('support_ticket_id', $ticketIds)
                ->where('from_admin', true)
                ->where('is_read', false)
                ->count();

        return response()->json([
            'unread' => $totalUnread,
            'tickets' => $tickets,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'subject' => 'required|string|max:200',
            'message' => 'required|string|max:2000',
        ]);

        $user = $request->user();

        $ticket = SupportTicket::create([
            'user_id' => $user->id,
            'subject' => $data['subject'],
            'status' => 'open',
            'priority' => 'normal',
            'last_message_at' => now(),
        ]);

        SupportMessage::create([
            'support_ticket_id' => $ticket->id,
            'user_id' => $user->id,
            'body' => $data['message'],
            'from_admin' => false,
            'is_read' => true,
        ]);

        return response()->json(['ticket' => $ticket], 201);
    }

    public function show(SupportTicket $ticket, Request $request)
    {
        $user = $request->user();
        if ($ticket->user_id !== $user->id && $user->role !== 'admin') {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $messages = $ticket->messages()->orderBy('id')->get();

        if ($ticket->user_id === $user->id) {
            $ticket->messages()
                ->where('from_admin', true)
                ->where('is_read', false)
                ->update(['is_read' => true]);
        }

        return response()->json([
            'ticket' => $ticket,
            'messages' => $messages,
        ]);
    }

    public function reply(SupportTicket $ticket, Request $request)
    {
        $user = $request->user();
        if ($ticket->user_id !== $user->id && $user->role !== 'admin') {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $data = $request->validate([
            'message' => 'required|string|max:2000',
        ]);

        $fromAdmin = $user->role === 'admin';

        $message = SupportMessage::create([
            'support_ticket_id' => $ticket->id,
            'user_id' => $user->id,
            'body' => $data['message'],
            'from_admin' => $fromAdmin,
            'is_read' => !$fromAdmin,
        ]);

        $ticket->update([
            'last_message_at' => now(),
            'status' => $fromAdmin ? 'answered' : 'open',
        ]);

        return response()->json(['message' => $message], 201);
    }

    public function markAllRead(Request $request)
    {
        $user = $request->user();

        $ticketIds = SupportTicket::where('user_id', $user->id)->pluck('id');
        if ($ticketIds->isNotEmpty()) {
            SupportMessage::whereIn('support_ticket_id', $ticketIds)
                ->where('from_admin', true)
                ->where('is_read', false)
                ->update(['is_read' => true]);
        }

        return response()->json(['status' => 'ok']);
    }
}
