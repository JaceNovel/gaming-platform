<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PhoneChangeRequest;
use App\Models\User;
use App\Services\AdminAuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AdminPhoneChangeController extends Controller
{
    public function indexByUser(Request $request, User $user)
    {
        $rows = PhoneChangeRequest::query()
            ->where('user_id', $user->id)
            ->latest('id')
            ->limit(50)
            ->get();

        $disk = Storage::disk('public');

        $data = $rows->map(function (PhoneChangeRequest $row) use ($disk) {
            return [
                'id' => $row->id,
                'old_phone' => $row->old_phone,
                'new_phone' => $row->new_phone,
                'reason' => $row->reason,
                'status' => $row->status,
                'admin_note' => $row->admin_note,
                'created_at' => optional($row->created_at)->toIso8601String(),
                'processed_at' => optional($row->processed_at)->toIso8601String(),
                'pdf_url' => $row->pdf_path ? $disk->url($row->pdf_path) : null,
                'attachment_url' => $row->attachment_path ? $disk->url($row->attachment_path) : null,
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function applyManual(Request $request, User $user, AdminAuditLogger $auditLogger)
    {
        $data = $request->validate([
            'old_phone' => ['required', 'string', 'max:64'],
            'new_phone' => ['required', 'string', 'max:64'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $oldPhone = trim((string) $data['old_phone']);
        $newPhone = trim((string) $data['new_phone']);

        $previous = (string) ($user->phone ?? '');
        $user->phone = $newPhone;
        $user->save();

        $auditLogger->log(
            $request->user(),
            'admin_phone_change',
            [
                'message' => 'Admin changed user phone',
                'user_id' => $user->id,
                'from' => $previous,
                'old_phone_input' => $oldPhone,
                'to' => $newPhone,
                'note' => $data['note'] ?? null,
            ],
            actionType: 'users',
            request: $request
        );

        return response()->json(['ok' => true, 'data' => ['user' => $user]]);
    }

    public function approve(Request $request, PhoneChangeRequest $phoneChangeRequest, AdminAuditLogger $auditLogger)
    {
        if ($phoneChangeRequest->status !== 'pending') {
            return response()->json(['message' => 'Request already processed'], 422);
        }

        $data = $request->validate([
            'admin_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $user = $phoneChangeRequest->user;
        $previous = (string) ($user?->phone ?? '');
        if ($user) {
            $user->phone = $phoneChangeRequest->new_phone;
            $user->save();
        }

        $phoneChangeRequest->status = 'approved';
        $phoneChangeRequest->admin_note = $data['admin_note'] ?? null;
        $phoneChangeRequest->processed_by = $request->user()?->id;
        $phoneChangeRequest->processed_at = now();
        $phoneChangeRequest->save();

        $auditLogger->log(
            $request->user(),
            'phone_change_request_approved',
            [
                'message' => 'Approved phone change request',
                'request_id' => $phoneChangeRequest->id,
                'user_id' => $phoneChangeRequest->user_id,
                'from' => $previous,
                'to' => $phoneChangeRequest->new_phone,
                'admin_note' => $data['admin_note'] ?? null,
            ],
            actionType: 'users',
            request: $request
        );

        return response()->json(['ok' => true]);
    }

    public function reject(Request $request, PhoneChangeRequest $phoneChangeRequest, AdminAuditLogger $auditLogger)
    {
        if ($phoneChangeRequest->status !== 'pending') {
            return response()->json(['message' => 'Request already processed'], 422);
        }

        $data = $request->validate([
            'admin_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $phoneChangeRequest->status = 'rejected';
        $phoneChangeRequest->admin_note = $data['admin_note'] ?? null;
        $phoneChangeRequest->processed_by = $request->user()?->id;
        $phoneChangeRequest->processed_at = now();
        $phoneChangeRequest->save();

        $auditLogger->log(
            $request->user(),
            'phone_change_request_rejected',
            [
                'message' => 'Rejected phone change request',
                'request_id' => $phoneChangeRequest->id,
                'user_id' => $phoneChangeRequest->user_id,
                'admin_note' => $data['admin_note'] ?? null,
            ],
            actionType: 'users',
            request: $request
        );

        return response()->json(['ok' => true]);
    }
}
