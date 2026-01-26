<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use Illuminate\Http\Request;

class AdminSupportController extends Controller
{
    public function index(Request $request)
    {
        $query = SupportTicket::with(['user', 'assignedAdmin'])
            ->withCount(['messages as unread_count' => function ($q) {
                $q->where('from_admin', false)->where('is_read', false);
            }])
            ->latest('last_message_at');

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($priority = $request->query('priority')) {
            $query->where('priority', $priority);
        }

        if ($request->filled('assigned')) {
            $assigned = $request->query('assigned');
            if ($assigned === 'true') {
                $query->whereNotNull('assigned_admin_id');
            } elseif ($assigned === 'false') {
                $query->whereNull('assigned_admin_id');
            }
        }

        $perPage = $request->integer('per_page', 30);

        return response()->json($query->paginate($perPage));
    }

    public function reply(Request $request, SupportTicket $ticket)
    {
        $data = $request->validate([
            'message' => 'required|string|max:2000',
        ]);

        $admin = $request->user();

        $message = SupportMessage::create([
            'support_ticket_id' => $ticket->id,
            'user_id' => $admin->id,
            'body' => $data['message'],
            'from_admin' => true,
            'is_read' => true,
        ]);

        $ticket->update([
            'last_message_at' => now(),
            'status' => 'answered',
            'assigned_admin_id' => $ticket->assigned_admin_id ?? $admin->id,
            'assigned_at' => $ticket->assigned_admin_id ? $ticket->assigned_at : now(),
        ]);

        return response()->json(['message' => $message], 201);
    }

    public function update(Request $request, SupportTicket $ticket)
    {
        $data = $request->validate([
            'status' => 'nullable|string|max:32',
            'priority' => 'nullable|string|max:32',
            'assigned_admin_id' => 'nullable|exists:users,id',
        ]);

        if (array_key_exists('assigned_admin_id', $data)) {
            $data['assigned_at'] = $data['assigned_admin_id'] ? now() : null;
        }

        $ticket->update($data);

        return response()->json(['ticket' => $ticket->fresh(['user', 'assignedAdmin'])]);
    }
}
