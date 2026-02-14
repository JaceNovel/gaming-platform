<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class PlayIntegrityService
{
    public function decodeToken(string $integrityToken): array
    {
        $serviceAccount = $this->loadServiceAccount();
        $packageName = (string) config('services.play_integrity.package_name');
        $accessToken = $this->getAccessToken($serviceAccount);

        $endpoint = sprintf('https://playintegrity.googleapis.com/v1/%s:decodeIntegrityToken', $packageName);

        $res = Http::withToken($accessToken)
            ->timeout(15)
            ->post($endpoint, [
                'integrity_token' => $integrityToken,
            ]);

        if (!$res->ok()) {
            return [
                'ok' => false,
                'status' => $res->status(),
                'body' => $res->body(),
            ];
        }

        $payload = $res->json();
        return [
            'ok' => true,
            'payload' => $payload,
        ];
    }

    private function loadServiceAccount(): array
    {
        $json = (string) config('services.play_integrity.service_account_json');
        $path = (string) config('services.play_integrity.service_account_path');

        if ($json !== '') {
            $decoded = json_decode($json, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        if ($path !== '' && file_exists($path)) {
            $decoded = json_decode((string) file_get_contents($path), true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        throw new \RuntimeException('Play Integrity service account not configured');
    }

    private function getAccessToken(array $serviceAccount): string
    {
        $clientEmail = (string) ($serviceAccount['client_email'] ?? '');
        $privateKey = (string) ($serviceAccount['private_key'] ?? '');

        if ($clientEmail === '' || $privateKey === '') {
            throw new \RuntimeException('Play Integrity service account is missing fields');
        }

        $now = time();
        $header = $this->base64UrlEncode(json_encode([
            'alg' => 'RS256',
            'typ' => 'JWT',
        ], JSON_UNESCAPED_SLASHES));

        $claims = $this->base64UrlEncode(json_encode([
            'iss' => $clientEmail,
            'scope' => 'https://www.googleapis.com/auth/playintegrity',
            'aud' => 'https://oauth2.googleapis.com/token',
            'iat' => $now,
            'exp' => $now + 3600,
        ], JSON_UNESCAPED_SLASHES));

        $unsignedJwt = $header . '.' . $claims;
        $signature = '';

        $success = openssl_sign($unsignedJwt, $signature, $privateKey, 'sha256');
        if (!$success) {
            throw new \RuntimeException('Unable to sign Play Integrity JWT');
        }

        $jwt = $unsignedJwt . '.' . $this->base64UrlEncode($signature);

        $res = Http::asForm()
            ->timeout(15)
            ->post('https://oauth2.googleapis.com/token', [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $jwt,
            ]);

        if (!$res->ok()) {
            throw new \RuntimeException('Unable to fetch Play Integrity access token');
        }

        $payload = $res->json();
        $token = is_array($payload) ? (string) ($payload['access_token'] ?? '') : '';
        if ($token === '') {
            throw new \RuntimeException('Play Integrity access token missing');
        }

        return $token;
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
