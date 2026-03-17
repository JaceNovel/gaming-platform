<?php

namespace App\Services;

use App\Models\SupplierAccount;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use SimpleXMLElement;

class SupplierOAuthService
{
    public function createAuthorizationUrl(SupplierAccount $account, ?int $adminUserId = null): string
    {
        $config = $this->platformConfig($account->platform);
        $authorizeUrl = trim((string) ($config['authorize_url'] ?? ''));
        if ($authorizeUrl === '') {
            throw new \RuntimeException('URL OAuth authorize non configurée pour ' . $account->platform);
        }

        $appKey = trim((string) ($account->app_key ?? ''));
        if ($appKey === '') {
            throw new \RuntimeException('App Key manquante sur le compte fournisseur.');
        }

        $state = 'supplieroauth' . Str::random(32);
        $ttl = max(1, (int) config('services.sourcing.oauth_state_ttl_minutes', 15));
        Cache::put($state, [
            'supplier_account_id' => $account->id,
            'platform' => $account->platform,
            'admin_user_id' => $adminUserId,
        ], now()->addMinutes($ttl));

        $query = [
            'client_id' => $appKey,
            'redirect_uri' => $this->callbackUrl($account->platform),
            'response_type' => 'code',
            'state' => $state,
        ];

        if (filter_var($config['include_optional_authorize_params'] ?? false, FILTER_VALIDATE_BOOL)) {
            $query = array_merge($query, array_filter([
                'scope' => trim((string) ($config['default_scope'] ?? '')) ?: null,
                'force_auth' => filter_var($config['authorize_force_auth'] ?? false, FILTER_VALIDATE_BOOL) ? 'true' : null,
                'uuid' => trim((string) ($config['authorize_uuid'] ?? '')) ?: null,
            ], static fn ($value) => $value !== null && $value !== ''));
        }

        return $authorizeUrl . (str_contains($authorizeUrl, '?') ? '&' : '?') . Arr::query($query);
    }

    public function handleCallback(string $platform, string $state, string $code): SupplierAccount
    {
        $cached = Cache::pull($state);
        if (!is_array($cached) || (string) ($cached['platform'] ?? '') !== $platform) {
            throw new \RuntimeException('État OAuth invalide ou expiré.');
        }

        $account = SupplierAccount::query()->findOrFail((int) $cached['supplier_account_id']);
        $tokens = $this->exchangeCode($account, $code);

        $account->update([
            'access_token' => $tokens['access_token'] ?? $account->access_token,
            'refresh_token' => $tokens['refresh_token'] ?? $account->refresh_token,
            'access_token_expires_at' => $tokens['access_token_expires_at'] ?? $account->access_token_expires_at,
            'refresh_token_expires_at' => $tokens['refresh_token_expires_at'] ?? $account->refresh_token_expires_at,
            'resource_owner' => $tokens['resource_owner'] ?? $account->resource_owner,
            'member_id' => $tokens['member_id'] ?? $account->member_id,
            'last_sync_at' => now(),
            'last_error_at' => null,
            'last_error_message' => null,
        ]);

        return $account->fresh();
    }

    public function refreshToken(SupplierAccount $account): SupplierAccount
    {
        $config = $this->platformConfig($account->platform);
        $refreshUrl = trim((string) ($config['refresh_url'] ?? ''));
        if ($refreshUrl === '') {
            throw new \RuntimeException('URL OAuth refresh non configurée pour ' . $account->platform);
        }

        $parsed = $this->ioRequest($account, $refreshUrl, [
            'refresh_token' => (string) ($account->refresh_token ?? ''),
        ]);

        $account->update([
            'access_token' => $parsed['access_token'] ?? $account->access_token,
            'refresh_token' => $parsed['refresh_token'] ?? $account->refresh_token,
            'access_token_expires_at' => $parsed['access_token_expires_at'] ?? $account->access_token_expires_at,
            'refresh_token_expires_at' => $parsed['refresh_token_expires_at'] ?? $account->refresh_token_expires_at,
            'last_sync_at' => now(),
            'last_error_at' => null,
            'last_error_message' => null,
        ]);

        return $account->fresh();
    }

    private function exchangeCode(SupplierAccount $account, string $code): array
    {
        $config = $this->platformConfig($account->platform);
        $tokenUrl = trim((string) ($config['token_url'] ?? ''));
        if ($tokenUrl === '') {
            throw new \RuntimeException('URL OAuth token non configurée pour ' . $account->platform);
        }

        return $this->ioRequest($account, $tokenUrl, [
            'code' => $code,
        ]);
    }

    private function parseTokenResponse(array $payload): array
    {
        $accessToken = $payload['access_token'] ?? $payload['accessToken'] ?? null;
        $refreshToken = $payload['refresh_token'] ?? $payload['refreshToken'] ?? null;
        $expireTimeMs = (int) ($payload['expire_time'] ?? 0);
        $refreshValidTimeMs = (int) ($payload['refresh_token_valid_time'] ?? 0);
        $expiresIn = (int) ($payload['expires_in'] ?? 0);
        $refreshExpiresIn = (int) ($payload['refresh_expires_in'] ?? 0);
        $userInfo = is_array($payload['user_info'] ?? null) ? $payload['user_info'] : [];

        return [
            'access_token' => $accessToken,
            'refresh_token' => $refreshToken,
            'access_token_expires_at' => $expireTimeMs > 0
                ? now()->setTimestamp((int) floor($expireTimeMs / 1000))
                : ($expiresIn > 0 ? now()->addSeconds($expiresIn) : null),
            'refresh_token_expires_at' => $refreshValidTimeMs > 0
                ? now()->setTimestamp((int) floor($refreshValidTimeMs / 1000))
                : ($refreshExpiresIn > 0 ? now()->addSeconds($refreshExpiresIn) : null),
            'resource_owner' => $payload['account'] ?? $payload['user_nick'] ?? null,
            'member_id' => $payload['seller_id'] ?? $payload['user_id'] ?? $userInfo['seller_id'] ?? $userInfo['user_id'] ?? $payload['account_id'] ?? null,
            'scopes_json' => array_values(array_filter([
                $payload['sp'] ?? null,
                $payload['country'] ?? null,
                $payload['account_platform'] ?? null,
            ])),
        ];
    }

    private function ioRequest(SupplierAccount $account, string $url, array $params): array
    {
        $config = $this->platformConfig($account->platform);
        $request = Http::asForm()
            ->timeout((int) ($config['timeout'] ?? 20))
            ->acceptJson();

        $filteredParams = array_filter($params, static fn ($value) => $value !== null && $value !== '');
        $resolvedUrl = $this->resolveIoAuthUrl($account, $url);
        $apiName = $this->extractIoApiName($resolvedUrl);
        $commonParams = $this->buildIoAuthCommonParams($account, $apiName, $filteredParams);
        $requestUrl = $this->appendQueryParams($resolvedUrl, $commonParams);

        $attempt = 'sdk-post';
        $response = $request->post($requestUrl, $filteredParams);

        if ($response->status() === 404 || $response->status() === 405) {
            $attempt = 'sdk-get';
            $response = $request->get($requestUrl, $filteredParams);
        }

        if (!$response->successful()) {
            throw new \RuntimeException('Appel OAuth IOP échoué (HTTP ' . $response->status() . ', mode ' . $attempt . ', url ' . $requestUrl . '): ' . $response->body());
        }

        $payload = $this->decodeIoAuthResponse($response->body());
        if ((string) ($payload['code'] ?? '0') !== '0') {
            throw new \RuntimeException(($payload['message'] ?? 'Erreur OAuth IOP') . ' [' . ($payload['code'] ?? 'unknown') . ']');
        }

        if (!filled($payload['access_token'] ?? null) && !filled($payload['refresh_token'] ?? null)) {
            throw new \RuntimeException('Réponse OAuth IOP reçue sans access_token ni refresh_token: ' . Str::limit(trim($response->body()), 500));
        }

        return $this->parseTokenResponse($payload);
    }

    private function decodeIoAuthResponse(string $body): array
    {
        $decodedJson = json_decode($body, true);
        if (is_array($decodedJson)) {
            return $decodedJson;
        }

        $trimmed = trim($body);
        if ($trimmed === '' || !str_starts_with($trimmed, '<')) {
            return [];
        }

        libxml_use_internal_errors(true);
        $xml = simplexml_load_string($trimmed, SimpleXMLElement::class, LIBXML_NOCDATA);
        libxml_clear_errors();

        if (!$xml instanceof SimpleXMLElement) {
            return [];
        }

        $parsed = $this->xmlElementToArray($xml);

        return is_array($parsed) ? $parsed : [];
    }

    private function xmlElementToArray(SimpleXMLElement $element): array|string
    {
        $children = $element->children();
        if ($children->count() === 0) {
            return (string) $element;
        }

        $result = [];
        foreach ($children as $name => $child) {
            $value = $this->xmlElementToArray($child);

            if (array_key_exists($name, $result)) {
                if (!is_array($result[$name]) || !array_is_list($result[$name])) {
                    $result[$name] = [$result[$name]];
                }
                $result[$name][] = $value;
                continue;
            }

            $result[$name] = $value;
        }

        return $result;
    }

    private function resolveIoAuthUrl(SupplierAccount $account, string $url): string
    {
        $host = (string) (parse_url($url, PHP_URL_HOST) ?? '');
        $path = (string) (parse_url($url, PHP_URL_PATH) ?? '');

        if (in_array($host, ['openapi-auth.alibaba.com', 'openapi.alibaba.com'], true)) {
            return $this->normalizeAlibabaOauthGatewayUrl($url);
        }

        if ($host === 'api.alibaba.com' && $path !== '') {
            return $this->withIoRestPrefix($url);
        }

        return $url;
    }

    private function normalizeAlibabaOauthGatewayUrl(string $url): string
    {
        $path = (string) (parse_url($url, PHP_URL_PATH) ?? '');
        $path = $path === '' ? '/auth/token/create' : $path;

        return $this->withIoRestPrefix('https://api.alibaba.com' . (str_starts_with($path, '/') ? $path : '/' . $path));
    }

    private function withIoRestPrefix(string $url): string
    {
        $path = (string) (parse_url($url, PHP_URL_PATH) ?? '');
        if ($path === '' || str_starts_with($path, '/rest/')) {
            return $url;
        }

        $base = rtrim((string) preg_replace('#' . preg_quote($path, '#') . '$#', '', $url), '/');

        return $base . '/rest' . (str_starts_with($path, '/') ? $path : '/' . $path);
    }

    private function extractIoApiName(string $url): string
    {
        $path = (string) (parse_url($url, PHP_URL_PATH) ?? '');
        if (str_starts_with($path, '/rest/')) {
            return substr($path, 5);
        }

        return $path === '' ? '/auth/token/create' : $path;
    }

    private function buildIoAuthCommonParams(SupplierAccount $account, string $apiName, array $bizParams): array
    {
        $appKey = trim((string) ($account->app_key ?? ''));
        $appSecret = (string) ($account->app_secret ?? '');
        if ($appKey === '' || $appSecret === '') {
            throw new \RuntimeException('App Key / App Secret manquants pour l’échange OAuth IOP.');
        }

        $commonParams = [
            'app_key' => $appKey,
            'timestamp' => (string) round(microtime(true) * 1000),
            'sign_method' => strtolower((string) data_get($this->platformConfig($account->platform), 'sign_method', 'sha256')) === 'md5'
                ? 'md5'
                : 'sha256',
            'partner_id' => 'iop-sdk-php',
        ];

        $signingParams = array_merge($commonParams, $bizParams);
        ksort($signingParams);

        $payload = $apiName;
        foreach ($signingParams as $key => $value) {
            $payload .= $key . $value;
        }

        $algorithm = $commonParams['sign_method'];

        $commonParams['sign'] = strtoupper(hash_hmac($algorithm, $payload, $appSecret));

        return $commonParams;
    }

    private function appendQueryParams(string $url, array $params): string
    {
        return $url . (str_contains($url, '?') ? '&' : '?') . Arr::query($params);
    }

    private function callbackUrl(string $platform): string
    {
        $configured = trim((string) data_get(config('services.sourcing.platforms'), $platform . '.callback_url', ''));
        if ($configured !== '') {
            return $configured;
        }

        $base = rtrim((string) config('app.url'), '/');
        return $base . '/api/sourcing/oauth/' . $platform . '/callback';
    }

    private function platformConfig(string $platform): array
    {
        return (array) data_get(config('services.sourcing.platforms'), $platform, []);
    }
}