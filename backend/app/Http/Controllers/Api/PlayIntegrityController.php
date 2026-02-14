<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PlayIntegrityService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class PlayIntegrityController extends Controller
{
    public function verify(Request $request, PlayIntegrityService $service)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Non authentifie'], 401);
        }

        $data = $request->validate([
            'integrity_token' => ['required', 'string', 'min:10'],
            'nonce' => ['required', 'string', 'min:8'],
        ]);

        $packageName = (string) config('services.play_integrity.package_name');
        $token = (string) $data['integrity_token'];
        $nonce = (string) $data['nonce'];

        $decoded = $service->decodeToken($token);
        if (!($decoded['ok'] ?? false)) {
            return response()->json([
                'ok' => false,
                'allowed' => false,
                'message' => 'Integrity decode failed',
            ], 422);
        }

        $payload = $decoded['payload'] ?? [];
        $payloadExternal = is_array($payload) ? ($payload['tokenPayloadExternal'] ?? []) : [];
        $requestDetails = is_array($payloadExternal) ? ($payloadExternal['requestDetails'] ?? []) : [];
        $appIntegrity = is_array($payloadExternal) ? ($payloadExternal['appIntegrity'] ?? []) : [];
        $deviceIntegrity = is_array($payloadExternal) ? ($payloadExternal['deviceIntegrity'] ?? []) : [];
        $accountDetails = is_array($payloadExternal) ? ($payloadExternal['accountDetails'] ?? []) : [];

        $nonceMatches = (string) ($requestDetails['nonce'] ?? '') === $nonce;
        $packageMatches = (string) ($requestDetails['requestPackageName'] ?? '') === $packageName;

        $appVerdict = (string) ($appIntegrity['appRecognitionVerdict'] ?? '');
        $deviceVerdicts = $deviceIntegrity['deviceRecognitionVerdict'] ?? [];
        if (!is_array($deviceVerdicts)) {
            $deviceVerdicts = [];
        }

        $deviceOk = in_array('MEETS_DEVICE_INTEGRITY', $deviceVerdicts, true)
            || in_array('MEETS_STRONG_INTEGRITY', $deviceVerdicts, true)
            || in_array('MEETS_BASIC_INTEGRITY', $deviceVerdicts, true);

        $licenseVerdict = (string) ($accountDetails['appLicensingVerdict'] ?? '');
        $licenseOk = $licenseVerdict === '' || $licenseVerdict === 'LICENSED';

        $allowed = $nonceMatches && $packageMatches && $appVerdict === 'PLAY_RECOGNIZED' && $deviceOk && $licenseOk;

        Cache::put('play_integrity:user:' . $user->id, [
            'allowed' => $allowed,
            'verified_at' => now()->toIso8601String(),
            'nonce' => $nonce,
            'app_verdict' => $appVerdict,
            'device_verdicts' => $deviceVerdicts,
            'license_verdict' => $licenseVerdict,
        ], now()->addHours(6));

        return response()->json([
            'ok' => true,
            'allowed' => $allowed,
            'verdicts' => [
                'app' => $appVerdict,
                'device' => $deviceVerdicts,
                'license' => $licenseVerdict,
                'nonce' => $nonceMatches,
                'package' => $packageMatches,
            ],
        ]);
    }
}
