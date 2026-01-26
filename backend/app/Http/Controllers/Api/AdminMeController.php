<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class AdminMeController extends Controller
{
    public function __invoke(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'permissions' => $this->resolvePermissions($user->role),
            ],
        ]);
    }

    private function resolvePermissions(string $role): array
    {
        $base = [
            'manage_products' => in_array($role, ['admin_super', 'admin', 'staff'], true),
            'manage_redeem' => in_array($role, ['admin_super', 'admin', 'staff'], true),
            'manage_orders' => in_array($role, ['admin_super', 'admin', 'staff'], true),
            'manage_users' => $role === 'admin_super',
            'view_audit_logs' => $role === 'admin_super',
        ];

        return $base;
    }
}
