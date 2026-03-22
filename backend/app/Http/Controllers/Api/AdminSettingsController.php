<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use App\Models\User;
use App\Services\AdminAuditLogger;
use App\Services\AdminResponsibilityService;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AdminSettingsController extends Controller
{
    public function show(AdminResponsibilityService $responsibilityService)
    {
        return response()->json([
            'logo_url' => $this->getSetting('logo_url'),
            'whatsapp_number' => $this->getSetting('whatsapp_number'),
            'terms' => $this->getSetting('terms'),
            'admin_roles' => $responsibilityService->roleCatalog(),
            'responsibilities' => $responsibilityService->responsibilityCatalog(),
            'responsibility_assignments' => $responsibilityService->assignments(),
            'admins' => $responsibilityService->adminMembers(),
        ]);
    }

    public function update(
        Request $request,
        AdminResponsibilityService $responsibilityService,
        AdminAuditLogger $auditLogger
    )
    {
        $data = $request->validate([
            'whatsapp_number' => 'nullable|string|max:30',
            'terms' => 'nullable|string',
            'admins' => 'nullable|array',
            'admins.*.id' => 'required_with:admins|integer|exists:users,id',
            'admins.*.role' => 'required_with:admins|string|max:32',
            'responsibility_assignments' => 'nullable|array',
        ]);

        $allowedRoles = User::allowedRoles();

        foreach ((array) ($data['admins'] ?? []) as $member) {
            $role = (string) ($member['role'] ?? '');
            if (!in_array($role, $allowedRoles, true)) {
                throw ValidationException::withMessages([
                    'admins' => ['Role admin invalide.'],
                ]);
            }
        }

        DB::transaction(function () use ($data, $request, $responsibilityService, $auditLogger) {
            if (array_key_exists('whatsapp_number', $data)) {
                $this->saveSetting('whatsapp_number', $data['whatsapp_number']);
            }

            if (array_key_exists('terms', $data)) {
                $this->saveSetting('terms', $data['terms']);
            }

            foreach ((array) ($data['admins'] ?? []) as $member) {
                $user = User::query()->find((int) $member['id']);
                if (!$user) {
                    continue;
                }

                $nextRole = (string) $member['role'];
                $previousRole = (string) $user->role;
                if ($previousRole === $nextRole) {
                    continue;
                }

                $user->update(['role' => $nextRole]);

                $auditLogger->log(
                    $request->user(),
                    'admin_settings_role_update',
                    [
                        'message' => 'Updated admin role from settings',
                        'user_id' => $user->id,
                        'from' => $previousRole,
                        'to' => $nextRole,
                    ],
                    actionType: 'settings',
                    request: $request
                );
            }

            if (array_key_exists('responsibility_assignments', $data)) {
                $assignments = $responsibilityService->saveAssignments((array) $data['responsibility_assignments']);

                $auditLogger->log(
                    $request->user(),
                    'admin_responsibility_assignments_update',
                    [
                        'message' => 'Updated admin responsibility assignments',
                        'assignments' => $assignments,
                    ],
                    actionType: 'settings',
                    request: $request
                );
            }
        });

        return $this->show($responsibilityService);
    }

    public function uploadLogo(Request $request)
    {
        $request->validate([
            'logo' => 'required|image|max:2048',
        ]);

        $path = $request->file('logo')->store('logos', 'public');
        $url = Storage::url($path);

        $this->saveSetting('logo_url', $url);

        return response()->json(['logo_url' => $url]);
    }

    private function saveSetting(string $key, ?string $value): void
    {
        SiteSetting::updateOrCreate(['key' => $key], ['value' => $value]);
    }

    private function getSetting(string $key): ?string
    {
        return optional(SiteSetting::where('key', $key)->first())->value;
    }
}
