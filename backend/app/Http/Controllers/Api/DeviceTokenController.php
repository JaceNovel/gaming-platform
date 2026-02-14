<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeviceToken;
use Illuminate\Http\Request;

class DeviceTokenController extends Controller
{
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Non authentifié'], 401);
        }

        $data = $request->validate([
            'token' => ['required', 'string', 'min:10'],
            'platform' => ['nullable', 'string', 'max:20'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $token = trim((string) $data['token']);
        $platform = isset($data['platform']) ? trim((string) $data['platform']) : null;
        $deviceName = isset($data['device_name']) ? trim((string) $data['device_name']) : null;

        $row = DeviceToken::query()->firstOrNew(['token' => $token]);
        $row->user_id = $user->id;
        $row->platform = $platform !== '' ? $platform : $row->platform;
        $row->device_name = $deviceName !== '' ? $deviceName : $row->device_name;
        $row->last_seen_at = now();
        $row->save();

        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Non authentifié'], 401);
        }

        $data = $request->validate([
            'token' => ['required', 'string', 'min:10'],
        ]);

        $token = trim((string) $data['token']);
        DeviceToken::query()->where('user_id', $user->id)->where('token', $token)->delete();

        return response()->json(['ok' => true]);
    }
}
