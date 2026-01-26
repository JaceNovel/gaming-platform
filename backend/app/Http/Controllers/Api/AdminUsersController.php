<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AdminAuditLogger;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminUsersController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query()->latest('id');

        if ($request->filled('role')) {
            $query->where('role', $request->query('role'));
        }

        if ($request->filled('email')) {
            $query->where('email', 'like', '%' . $request->query('email') . '%');
        }

        if ($request->filled('name')) {
            $query->where('name', 'like', '%' . $request->query('name') . '%');
        }

        $perPage = $request->integer('per_page', 30);

        return response()->json($query->paginate($perPage));
    }

    public function update(Request $request, User $user, AdminAuditLogger $auditLogger)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|max:255|unique:users,email,' . $user->id,
            'role' => 'sometimes|string|max:32',
            'country_code' => 'nullable|string|max:8',
            'country_name' => 'nullable|string|max:120',
            'is_premium' => 'nullable|boolean',
            'premium_level' => 'nullable|string|max:32',
            'premium_expiration' => 'nullable|date',
        ]);

        $oldRole = $user->role;
        $user->update($data);

        if (array_key_exists('role', $data) && $oldRole !== $data['role']) {
            $auditLogger->log(
                $request->user(),
                'user_role_update',
                [
                    'message' => 'Updated user role',
                    'user_id' => $user->id,
                    'from' => $oldRole,
                    'to' => $data['role'],
                ],
                actionType: 'users',
                request: $request
            );
        }

        return response()->json(['data' => $user]);
    }

    public function export(Request $request)
    {
        $query = User::query()->latest('id');

        if ($request->filled('role')) {
            $query->where('role', $request->query('role'));
        }

        $filename = 'users-' . now()->format('Ymd_His') . '.csv';

        return new StreamedResponse(function () use ($query) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'id',
                'name',
                'email',
                'role',
                'country_code',
                'country_name',
                'is_premium',
                'premium_level',
                'premium_expiration',
                'created_at',
            ]);

            $query->chunk(500, function ($rows) use ($handle) {
                foreach ($rows as $row) {
                    fputcsv($handle, [
                        $row->id,
                        $row->name,
                        $row->email,
                        $row->role,
                        $row->country_code,
                        $row->country_name,
                        $row->is_premium ? '1' : '0',
                        $row->premium_level,
                        optional($row->premium_expiration)->format('Y-m-d'),
                        optional($row->created_at)->toIso8601String(),
                    ]);
                }
            });

            fclose($handle);
        }, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }
}
