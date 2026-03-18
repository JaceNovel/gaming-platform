<?php

namespace App\Services;

use App\Models\SupplierAccount;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use SimpleXMLElement;

class SupplierApiClient
{
    public function fetchRemoteProduct(SupplierAccount $account, string $externalProductId, ?string $lookupType = null, array $options = []): array
    {
        $config = $this->platformConfig($account->platform);
        $remoteMode = (string) ($options['remote_mode'] ?? 'standard');
        $methodName = match ($remoteMode) {
            'ds_product' => trim((string) ($config['ds_product_get_method'] ?? '')),
            'ds_wholesale' => trim((string) ($config['ds_product_wholesale_get_method'] ?? '')),
            default => trim((string) ($config['product_detail_method'] ?? $config['product_detail_path'] ?? '')),
        };
        $lookupParam = trim((string) ($config['product_lookup_param'] ?? 'product_id'));
        if ($methodName === '') {
            throw new \RuntimeException('Méthode IOP de détail produit non configurée pour ' . $account->platform);
        }

        $response = $this->request($account, $methodName, $this->buildProductLookupParams($methodName, $lookupParam, $externalProductId, $lookupType, $options));

        return $this->normalizeProductResponse($account, $externalProductId, $response, $methodName, $options);
    }

    public function searchRemoteProducts(SupplierAccount $account, array $filters): array
    {
        $config = $this->platformConfig($account->platform);
        $methodName = trim((string) ($config['product_search_method'] ?? ''));
        if ($methodName === '') {
            throw new \RuntimeException('Méthode IOP de recherche produit non configurée pour ' . $account->platform);
        }

        $response = $this->request($account, $methodName, [
            'page_index' => (int) ($filters['page_index'] ?? 1),
            'page_size' => min(20, max(1, (int) ($filters['page_size'] ?? 10))),
            'model_number' => $filters['model_number'] ?? null,
            'sku_code' => $filters['sku_code'] ?? null,
        ]);

        return $this->normalizeSearchResponse($response);
    }

    public function predictCategory(SupplierAccount $account, array $attributes): array
    {
        $config = $this->platformConfig($account->platform);
        $methodName = trim((string) ($config['category_predict_method'] ?? ''));
        if ($methodName === '') {
            throw new \RuntimeException('Méthode IOP de prédiction de catégorie non configurée pour ' . $account->platform);
        }

        $response = $this->request($account, $methodName, [
            'title' => $attributes['title'] ?? null,
            'description' => $attributes['description'] ?? null,
            'image' => $attributes['image'] ?? null,
        ]);

        $result = $response['result']['data'] ?? [];

        return [
            'category_id' => $result['category_id'] ?? null,
            'category_name' => $result['category_name'] ?? null,
            'category_path' => $result['category_path'] ?? null,
            'message' => $response['result']['message'] ?? null,
            'msg_code' => $response['result']['msg_code'] ?? null,
            'raw' => $response,
        ];
    }

    public function uploadVideo(SupplierAccount $account, array $attributes): array
    {
        $methodName = trim((string) ($this->platformConfig($account->platform)['video_upload_method'] ?? ''));
        if ($methodName === '') {
            throw new \RuntimeException('Méthode IOP d’upload vidéo non configurée pour ' . $account->platform);
        }

        $response = $this->request($account, $methodName, [
            'video_path' => $attributes['video_path'] ?? null,
            'video_name' => $attributes['video_name'] ?? null,
            'video_cover' => $attributes['video_cover'] ?? null,
        ]);

        return $this->normalizeVideoUploadResponse($response);
    }

    public function getVideoUploadResult(SupplierAccount $account, string $requestId): array
    {
        $methodName = trim((string) ($this->platformConfig($account->platform)['video_upload_result_method'] ?? ''));
        if ($methodName === '') {
            throw new \RuntimeException('Méthode IOP de suivi upload vidéo non configurée pour ' . $account->platform);
        }

        $response = $this->request($account, $methodName, [
            'req_id' => $requestId,
        ]);

        return $this->normalizeVideoUploadResponse($response);
    }

    public function queryVideos(SupplierAccount $account, array $filters): array
    {
        $methodName = trim((string) ($this->platformConfig($account->platform)['video_query_method'] ?? ''));
        if ($methodName === '') {
            throw new \RuntimeException('Méthode IOP de liste vidéo non configurée pour ' . $account->platform);
        }

        $response = $this->request($account, $methodName, [
            'current_page' => max(1, (int) ($filters['current_page'] ?? 1)),
            'page_size' => min(50, max(1, (int) ($filters['page_size'] ?? 10))),
            'video_id' => $filters['video_id'] ?? null,
        ]);

        $model = data_get($response, 'result.model', []);
        $list = array_map(function ($video) {
            if (!is_array($video)) {
                return [];
            }

            return [
                'video_id' => $video['video_id'] ?? null,
                'title' => $video['title'] ?? null,
                'status' => $video['status'] ?? null,
                'quality' => $video['quality'] ?? null,
                'video_url' => $video['video_url'] ?? null,
                'cover_url' => $video['cover_url'] ?? null,
                'duration' => $video['duration'] ?? null,
                'file_size' => $video['file_size'] ?? null,
                'publish_time' => $video['publish_time'] ?? null,
                'raw' => $video,
            ];
        }, (array) ($model['list'] ?? []));

        return [
            'items' => $list,
            'current_page' => $model['current_page'] ?? null,
            'page_size' => $model['page_size'] ?? null,
            'total_count' => $model['total_count'] ?? null,
            'msg_code' => data_get($response, 'result.msg_code'),
            'message' => data_get($response, 'result.msg_info'),
            'raw' => $response,
        ];
    }

    public function attachVideoToProductMain(SupplierAccount $account, string $videoId, string $productId): array
    {
        $methodName = trim((string) ($this->platformConfig($account->platform)['video_relation_main_method'] ?? ''));
        if ($methodName === '') {
            throw new \RuntimeException('Méthode IOP de liaison vidéo produit non configurée pour ' . $account->platform);
        }

        $response = $this->request($account, $methodName, [
            'video_id' => $videoId,
            'product_id' => $productId,
        ]);

        return [
            'success' => filter_var($response['model'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'msg_code' => $response['msg_code'] ?? null,
            'message' => $response['msg_info'] ?? null,
            'raw' => $response,
        ];
    }

    public function buyerAddItem(SupplierAccount $account, array $insertReq): array
    {
        $methodName = trim((string) ($this->platformConfig($account->platform)['buyer_item_add_method'] ?? ''));
        if ($methodName === '') {
            throw new \RuntimeException('Méthode buyer item add non configurée pour ' . $account->platform);
        }

        $response = $this->ecoRequest($account, 'POST', $methodName, [
            'insertReq' => $insertReq,
        ]);

        return $this->normalizeBuyerResult($response);
    }

    public function buyerUpdateItem(SupplierAccount $account, array $updateReq): array
    {
        $methodName = trim((string) ($this->platformConfig($account->platform)['buyer_item_update_method'] ?? ''));
        if ($methodName === '') {
            throw new \RuntimeException('Méthode buyer item update non configurée pour ' . $account->platform);
        }

        $response = $this->ecoRequest($account, 'POST', $methodName, [
            'updateReq' => $updateReq,
        ]);

        return $this->normalizeBuyerResult($response);
    }

    public function buyerDeleteItem(SupplierAccount $account, array $deleteReq): array
    {
        $methodName = trim((string) ($this->platformConfig($account->platform)['buyer_item_delete_method'] ?? ''));
        if ($methodName === '') {
            throw new \RuntimeException('Méthode buyer item delete non configurée pour ' . $account->platform);
        }

        $response = $this->ecoRequest($account, 'PUT', $methodName, [
            'deleteReq' => $deleteReq,
        ]);

        return $this->normalizeBuyerResult($response);
    }

    public function buyerQueryItems(SupplierAccount $account, string|array $queryReq): array
    {
        $methodName = trim((string) ($this->platformConfig($account->platform)['buyer_item_query_method'] ?? ''));
        if ($methodName === '') {
            throw new \RuntimeException('Méthode buyer item query non configurée pour ' . $account->platform);
        }

        $response = $this->ecoRequest($account, 'GET', $methodName, [
            'queryReq' => $queryReq,
        ]);

        $resultData = data_get($response, 'result.result_data', []);
        $items = array_map(function ($item) {
            if (!is_array($item)) {
                return [];
            }

            return [
                'item_id' => $item['item_id'] ?? null,
                'isv_item_id' => $item['isv_item_id'] ?? null,
                'title' => $item['title'] ?? null,
                'description' => $item['description'] ?? null,
                'price' => $item['price'] ?? null,
                'original_price' => $item['original_price'] ?? null,
                'currency' => $item['currency'] ?? null,
                'available_quantity' => $item['available_quantity'] ?? null,
                'sold_quantity' => $item['sold_quantity'] ?? null,
                'permalink' => $item['permalink'] ?? null,
                'main_image_url' => $item['main_image_url'] ?? null,
                'isv_category' => $item['isv_category'] ?? null,
                'isv_category_id' => $item['isv_category_id'] ?? null,
                'variations' => $item['variations'] ?? [],
                'raw' => $item,
            ];
        }, (array) ($resultData['items'] ?? []));

        return [
            'result_code' => data_get($response, 'result.result_code'),
            'message' => data_get($response, 'result.result_msg'),
            'pagination' => $resultData['pagination'] ?? null,
            'items' => $items,
            'raw' => $response,
        ];
    }

    public function buyerEcoOperation(SupplierAccount $account, string $operation, string|array $requestPayload): array
    {
        $definition = $this->buyerEcoOperationDefinitions()[$operation] ?? null;
        if ($definition === null) {
            throw new \RuntimeException('Opération buyer eco non supportée: ' . $operation);
        }

        $methodName = trim((string) ($this->platformConfig($account->platform)[$definition['config_key']] ?? ''));
        if ($methodName === '') {
            throw new \RuntimeException('Méthode buyer eco non configurée pour ' . $operation);
        }

        $response = $this->ecoRequest($account, $definition['http_method'], $methodName, [
            $definition['param_key'] => $requestPayload,
        ]);

        return $this->normalizeBuyerEcoOperationResult($operation, $response);
    }

    public function iopOperation(SupplierAccount $account, string $operation, string|array|null $requestPayload = null): array
    {
        $definition = $this->iopOperationDefinitions()[$operation] ?? null;
        if ($definition === null) {
            throw new \RuntimeException('Opération IOP non supportée: ' . $operation);
        }

        $methodName = trim((string) ($this->platformConfig($account->platform)[$definition['config_key']] ?? ''));
        if ($methodName === '') {
            throw new \RuntimeException('Méthode IOP non configurée pour ' . $operation);
        }

        $params = [];
        if (($definition['param_key'] ?? null) !== null && $requestPayload !== null && $requestPayload !== '') {
            $params[$definition['param_key']] = $requestPayload;
        } elseif (is_array($requestPayload)) {
            $params = $requestPayload;
        }

        $response = $this->iopRequest($account, $definition['http_method'], $methodName, $params);

        return $this->normalizeIopOperationResult($operation, $response);
    }

    public function uploadOrderAttachment(SupplierAccount $account, string $fileName, string $fileContentBase64): array
    {
        $methodName = trim((string) ($this->platformConfig($account->platform)['order_attachment_upload_method'] ?? ''));
        if ($methodName === '') {
            throw new \RuntimeException('Méthode IOP order attachment upload non configurée pour ' . $account->platform);
        }

        $baseUrl = rtrim((string) ($this->platformConfig($account->platform)['api_base_url'] ?? ''), '/');
        if ($baseUrl === '') {
            throw new \RuntimeException('Base URL API non configurée pour ' . $account->platform);
        }

        $binary = base64_decode($fileContentBase64, true);
        if ($binary === false) {
            throw new \RuntimeException('Le contenu du fichier doit être un base64 valide.');
        }
        if (empty($account->access_token)) {
            throw new \RuntimeException('Access token fournisseur manquant. Lance d’abord la connexion OAuth.');
        }

        $response = $this->baseRequest((int) ($this->platformConfig($account->platform)['timeout'] ?? 20))
            ->attach('data', $binary, $fileName)
            ->post($baseUrl . $methodName, [
                'access_token' => (string) $account->access_token,
                'file_name' => $fileName,
            ]);

        if (!$response->successful()) {
            throw new \RuntimeException('Upload pièce jointe échoué (HTTP ' . $response->status() . '): ' . $response->body());
        }

        $payload = $response->json() ?? [];
        if ((string) ($payload['code'] ?? '0') !== '0') {
            throw new \RuntimeException(($payload['message'] ?? $payload['msg_info'] ?? 'Erreur upload pièce jointe') . ' [' . ($payload['code'] ?? 'unknown') . ']');
        }

        return [
            'filepath' => $payload['value'] ?? null,
            'raw' => $payload,
        ];
    }

    public function request(SupplierAccount $account, string $methodName, array $params = []): array
    {
        if (empty($account->access_token)) {
            throw new \RuntimeException('Access token fournisseur manquant. Lance d’abord la connexion OAuth.');
        }

        if ($this->usesTopBusinessApi($methodName)) {
            return $this->topRequest($account, 'POST', $methodName, $params, 'Appel API fournisseur');
        }

        return $this->gopRequest($account, 'POST', $methodName, $params, true, 'Appel API fournisseur');
    }

    public function ecoRequest(SupplierAccount $account, string $httpMethod, string $methodName, array $params = []): array
    {
        $config = $this->platformConfig($account->platform);
        $baseUrl = rtrim((string) ($config['api_base_url'] ?? ''), '/');
        if ($baseUrl === '') {
            throw new \RuntimeException('Base URL API non configurée pour ' . $account->platform);
        }

        if (!str_starts_with($methodName, '/')) {
            $methodName = '/' . $methodName;
        }

        $appKey = trim((string) ($account->app_key ?? ''));
        $appSecret = (string) ($account->app_secret ?? '');
        if ($appKey === '' || $appSecret === '') {
            throw new \RuntimeException('App Key / App Secret manquants pour les endpoints buyer solution.');
        }
        if (empty($account->access_token)) {
            throw new \RuntimeException('Access token fournisseur manquant. Lance d’abord la connexion OAuth.');
        }

        $normalizedParams = $this->normalizeEcoParams($params);
        $timestamp = (string) round(microtime(true) * 1000);
        $signMethod = strtoupper((string) ($config['sign_method'] ?? 'sha256'));
        $headers = [
            'app_key' => $appKey,
            'timestamp' => $timestamp,
            'access_token' => (string) $account->access_token,
            'sign_method' => strtolower($signMethod),
            'sign' => $this->signEcoRequest($methodName, $normalizedParams, $appSecret, $signMethod),
        ];

        $request = $this->baseRequest((int) ($config['timeout'] ?? 20))->withHeaders($headers);
        $url = $baseUrl . $methodName;
        $verb = strtoupper($httpMethod);

        $response = match ($verb) {
            'GET' => $request->get($url, $normalizedParams),
            'PUT' => $request->asJson()->put($url, $normalizedParams),
            default => $request->asJson()->post($url, $normalizedParams),
        };

        if (!$response->successful()) {
            throw new \RuntimeException('Appel API buyer solution échoué (HTTP ' . $response->status() . '): ' . $response->body());
        }

        $payload = $response->json() ?? [];
        if ((string) ($payload['code'] ?? '0') !== '0') {
            throw new \RuntimeException(($payload['message'] ?? $payload['msg_info'] ?? 'Erreur API buyer solution') . ' [' . ($payload['code'] ?? 'unknown') . ']');
        }

        return $payload;
    }

    public function iopRequest(SupplierAccount $account, string $httpMethod, string $methodName, array $params = []): array
    {
        if (empty($account->access_token)) {
            throw new \RuntimeException('Access token fournisseur manquant. Lance d’abord la connexion OAuth.');
        }

        if ($this->usesTopBusinessApi($methodName)) {
            return $this->topRequest($account, $httpMethod, $methodName, $params, 'Appel IOP');
        }

        return $this->gopRequest($account, $httpMethod, $methodName, $params, true, 'Appel IOP');
    }

    private function topRequest(
        SupplierAccount $account,
        string $httpMethod,
        string $methodName,
        array $params,
        string $errorPrefix
    ): array {
        $config = $this->platformConfig($account->platform);
        $baseUrl = $this->normalizeTopBaseUrl($account->platform, (string) ($config['api_base_url'] ?? ''));
        if ($baseUrl === '') {
            throw new \RuntimeException('Base URL API non configurée pour ' . $account->platform);
        }

        $appKey = trim((string) ($account->app_key ?? ''));
        $appSecret = (string) ($account->app_secret ?? '');
        if ($appKey === '' || $appSecret === '') {
            throw new \RuntimeException('App Key / App Secret manquants pour les appels TOP.');
        }

        $fileParams = $this->normalizeTopFileParams(Arr::pull($params, '__file_params', []));
        $businessParams = $this->normalizeIopParams($params);
        $signMethod = strtolower((string) ($config['sign_method'] ?? 'sha256')) === 'md5'
            ? 'md5'
            : 'sha256';
        $commonParams = [
            'method' => $methodName,
            'app_key' => $appKey,
            'timestamp' => (string) round(microtime(true) * 1000),
            'sign_method' => $signMethod,
            'access_token' => (string) $account->access_token,
        ];

        $signingParams = array_merge($commonParams, $businessParams);
        ksort($signingParams);

        $payload = '';
        foreach ($signingParams as $key => $value) {
            $payload .= $key . $value;
        }

        $commonParams['sign'] = strtoupper(hash_hmac($signMethod, $payload, $appSecret));

        $request = $this->baseRequest((int) ($config['timeout'] ?? 20));
        $verb = strtoupper($httpMethod);
        $url = rtrim($baseUrl, '/') . '/sync';

        $response = match ($verb) {
            'GET' => $request->get($url, array_merge($commonParams, $businessParams)),
            default => $this->sendTopPostRequest($request, $url, $commonParams, $businessParams, $fileParams),
        };

        if (!$response->successful()) {
            throw new \RuntimeException($errorPrefix . ' échoué (HTTP ' . $response->status() . ', url ' . $url . '): ' . $response->body());
        }

        $payload = $this->decodeResponseBody($response->body());
        $this->throwIfApiPayloadHasError($payload, 'Erreur TOP');
        if ((string) ($payload['code'] ?? '0') !== '0') {
            $message = (string) ($payload['message'] ?? $payload['msg'] ?? $payload['msg_info'] ?? 'Erreur TOP');
            $subCode = (string) ($payload['sub_code'] ?? '');
            $subMessage = (string) ($payload['sub_msg'] ?? '');

            if ($subCode !== '') {
                $message .= ' (' . $subCode . ')';
            }

            if ($subMessage !== '') {
                $message .= ': ' . $subMessage;
            }

            throw new \RuntimeException($message . ' [' . ($payload['code'] ?? 'unknown') . ']');
        }

        return $payload;
    }

    private function gopRequest(
        SupplierAccount $account,
        string $httpMethod,
        string $methodName,
        array $params,
        bool $includeAccessToken,
        string $errorPrefix
    ): array {
        $config = $this->platformConfig($account->platform);
        $baseUrl = $this->normalizeGopBaseUrl((string) ($config['api_base_url'] ?? ''));
        if ($baseUrl === '') {
            throw new \RuntimeException('Base URL API non configurée pour ' . $account->platform);
        }

        if (!str_starts_with($methodName, '/')) {
            $methodName = '/' . $methodName;
        }

        $businessParams = $this->normalizeIopParams($params);
        $requestUrl = $this->buildGopRequestUrl($account, $baseUrl, $methodName, $businessParams, $includeAccessToken);
        $request = $this->baseRequest((int) ($config['timeout'] ?? 20));
        $verb = strtoupper($httpMethod);

        $response = match ($verb) {
            'GET' => $request->get($requestUrl, $businessParams),
            default => $request->asForm()->post($requestUrl, $businessParams),
        };

        if (!$response->successful()) {
            throw new \RuntimeException($errorPrefix . ' échoué (HTTP ' . $response->status() . ', url ' . $requestUrl . '): ' . $response->body());
        }

        $payload = $this->decodeResponseBody($response->body());
        $this->throwIfApiPayloadHasError($payload, 'Erreur IOP');
        if ((string) ($payload['code'] ?? '0') !== '0') {
            $message = (string) ($payload['message'] ?? $payload['msg'] ?? $payload['msg_info'] ?? 'Erreur IOP');
            $subCode = (string) ($payload['sub_code'] ?? '');
            $subMessage = (string) ($payload['sub_msg'] ?? '');

            if ($subCode !== '') {
                $message .= ' (' . $subCode . ')';
            }

            if ($subMessage !== '') {
                $message .= ': ' . $subMessage;
            }

            throw new \RuntimeException($message . ' [' . ($payload['code'] ?? 'unknown') . ']');
        }

        return $payload;
    }

    private function buildGopRequestUrl(
        SupplierAccount $account,
        string $baseUrl,
        string $methodName,
        array $businessParams,
        bool $includeAccessToken
    ): string {
        $appKey = trim((string) ($account->app_key ?? ''));
        $appSecret = (string) ($account->app_secret ?? '');
        if ($appKey === '' || $appSecret === '') {
            throw new \RuntimeException('App Key / App Secret manquants pour les appels GOP.');
        }

        $timestamp = (string) round(microtime(true) * 1000);
        $signMethod = strtolower((string) ($this->platformConfig($account->platform)['sign_method'] ?? 'sha256')) === 'md5'
            ? 'md5'
            : 'sha256';

        $commonParams = [
            'app_key' => $appKey,
            'timestamp' => $timestamp,
            'sign_method' => $signMethod,
            'simplify' => 'true',
            'partner_id' => 'iop-sdk-php',
        ];

        if ($includeAccessToken) {
            $commonParams['access_token'] = (string) $account->access_token;
        }

        $signingParams = array_merge($commonParams, $businessParams);
        ksort($signingParams);

        $payload = $methodName;
        foreach ($signingParams as $key => $value) {
            $payload .= $key . $value;
        }

        $commonParams['sign'] = strtoupper(hash_hmac($signMethod, $payload, $appSecret));

        return rtrim($baseUrl, '/') . '/rest' . $methodName . '?' . Arr::query($commonParams);
    }

    private function normalizeGopBaseUrl(string $baseUrl): string
    {
        $trimmed = rtrim(trim($baseUrl), '/');
        if ($trimmed === '') {
            return '';
        }

        $host = (string) (parse_url($trimmed, PHP_URL_HOST) ?? '');
        $path = (string) (parse_url($trimmed, PHP_URL_PATH) ?? '');

        if (in_array($host, ['openapi.alibaba.com', 'api.alibaba.com', 'openapi-auth.alibaba.com'], true)) {
            return 'https://openapi-api.alibaba.com';
        }

        if ($host === 'openapi-api.alibaba.com' && ($path === '' || $path === '/rest')) {
            return 'https://openapi-api.alibaba.com';
        }

        return $trimmed;
    }

    private function normalizeTopBaseUrl(string $platform, string $baseUrl): string
    {
        $trimmed = rtrim(trim($baseUrl), '/');
        if ($trimmed === '') {
            return '';
        }

        $host = (string) (parse_url($trimmed, PHP_URL_HOST) ?? '');

        if ($platform === 'aliexpress' && in_array($host, ['openapi.alibaba.com', 'api.alibaba.com', 'openapi-api.alibaba.com', 'openapi-auth.alibaba.com'], true)) {
            return 'https://api-sg.aliexpress.com';
        }

        return $trimmed;
    }

    private function decodeResponseBody(string $body): array
    {
        $decoded = json_decode($body, true);
        if (is_array($decoded)) {
            return $decoded;
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

    private function throwIfApiPayloadHasError(array $payload, string $defaultMessage): void
    {
        $error = $this->extractApiErrorPayload($payload);
        if ($error === null) {
            return;
        }

        $message = (string) ($error['msg'] ?? $error['message'] ?? $error['msg_info'] ?? $defaultMessage);
        $subCode = (string) ($error['sub_code'] ?? $error['subCode'] ?? '');
        $subMessage = (string) ($error['sub_msg'] ?? $error['subMessage'] ?? '');
        $code = (string) ($error['code'] ?? $error['error_code'] ?? 'unknown');

        if ($subCode !== '') {
            $message .= ' (' . $subCode . ')';
        }

        if ($subMessage !== '') {
            $message .= ': ' . $subMessage;
        }

        throw new \RuntimeException($message . ' [' . $code . ']');
    }

    private function extractApiErrorPayload(array $payload): ?array
    {
        $candidates = [
            $payload['error_response'] ?? null,
            data_get($payload, 'response.error_response'),
            data_get($payload, 'result.error_response'),
        ];

        foreach ($candidates as $candidate) {
            if (is_array($candidate) && $candidate !== []) {
                return $candidate;
            }
        }

        return null;
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

    private function normalizeProductResponse(SupplierAccount $account, string $externalProductId, array $payload, string $methodName, array $options = []): array
    {
        if (in_array($methodName, [
            (string) ($this->platformConfig($account->platform)['ds_product_get_method'] ?? ''),
            (string) ($this->platformConfig($account->platform)['ds_product_wholesale_get_method'] ?? ''),
        ], true)) {
            return $this->normalizeAliExpressDsProductResponse($account, $externalProductId, $payload, $methodName, $options);
        }

        $root = $payload['result'] ?? $payload['data'] ?? $payload['result_data'] ?? $payload;
        $product = is_array($root['product'] ?? null)
            ? $root['product']
            : (is_array($payload['product_info'] ?? null)
                ? $payload['product_info']
                : (is_array($root['product_info'] ?? null) ? $root['product_info'] : $root));

        $basicInfo = is_array($product['basic_info'] ?? null) ? $product['basic_info'] : [];
        $tradeInfo = is_array($product['trade_info'] ?? null) ? $product['trade_info'] : [];
        $categoryInfo = is_array($product['category_info'] ?? null) ? $product['category_info'] : [];
        $logisticsInfo = is_array($product['logistics_info'] ?? null) ? $product['logistics_info'] : [];

        $title = $product['title']
            ?? $basicInfo['title']
            ?? $product['subject']
            ?? $product['product_title']
            ?? $product['name']
            ?? ('Produit ' . $externalProductId);

        $externalOfferId = $product['offer_id'] ?? $product['offerId'] ?? $basicInfo['product_id'] ?? null;
        $mainImageUrl = $product['main_image_url']
            ?? $product['mainImageUrl']
            ?? $product['image_url']
            ?? data_get($basicInfo, 'product_images.0.image_url')
            ?? data_get($product, 'main_image.images.0')
            ?? data_get($product, 'images.0')
            ?? null;

        $skuRows = $product['skus']
            ?? $product['sku_list']
            ?? $product['skuInfoList']
            ?? $product['productSkuList']
            ?? $product['sku_info']
            ?? $tradeInfo['sku_info']
            ?? data_get($product, 'product_sku.skus')
            ?? [];

        $normalizedSkus = [];
        foreach ((array) $skuRows as $sku) {
            if (!is_array($sku)) {
                continue;
            }

            $externalSkuId = (string) ($sku['external_sku_id'] ?? $sku['sku_id'] ?? $sku['skuId'] ?? $sku['id'] ?? '');
            if ($externalSkuId === '') {
                continue;
            }

            $normalizedSkus[] = [
                'external_sku_id' => $externalSkuId,
                'sku_label' => $sku['sku_label'] ?? $sku['skuAttr'] ?? $sku['title'] ?? $sku['name'] ?? null,
                'variant_attributes_json' => $sku['variant_attributes_json'] ?? $sku['attributes'] ?? $sku['specs'] ?? $sku['sale_attributes'] ?? [],
                'moq' => (int) ($sku['moq'] ?? $sku['minOrderQuantity'] ?? $tradeInfo['moq'] ?? data_get($product, 'sourcing_trade.min_order_quantity_sourcing') ?? data_get($product, 'wholesale_trade.min_order_quantity') ?? 1),
                'unit_price' => $sku['unit_price'] ?? $sku['price'] ?? $sku['offerPrice'] ?? data_get($sku, 'sku_price.price') ?? data_get($sku, 'bulk_discount_prices.0.bulk_discount_price') ?? data_get($tradeInfo, 'price.range_price.min_price') ?? data_get($tradeInfo, 'price.tiered_price.0.price') ?? data_get($product, 'sourcing_trade.fob_min_price') ?? data_get($product, 'wholesale_trade.price') ?? null,
                'currency_code' => $sku['currency_code'] ?? $sku['currency'] ?? data_get($sku, 'sku_price.currency') ?? data_get($tradeInfo, 'price.currency') ?? data_get($product, 'sourcing_trade.fob_currency') ?? $account->currency_code,
                'available_quantity' => $sku['available_quantity'] ?? $sku['quantity'] ?? $sku['inventory'] ?? data_get($sku, 'inventory_dtolist.0.inventory') ?? $tradeInfo['inventory'] ?? data_get($product, 'sourcing_trade.supply_quantity') ?? null,
                'lead_time_days' => $sku['lead_time_days'] ?? $sku['leadTime'] ?? data_get($logisticsInfo, 'tiered_lead_time.0.lead_time') ?? data_get($product, 'wholesale_trade.handling_time') ?? null,
                'logistics_modes_json' => Arr::wrap($sku['logistics_modes_json'] ?? $sku['logisticsModes'] ?? []),
                'sku_payload_json' => $sku,
            ];
        }

        if (empty($normalizedSkus)) {
            $normalizedSkus[] = [
                'external_sku_id' => $externalProductId . '-default',
                'sku_label' => 'Default',
                'moq' => (int) ($tradeInfo['moq'] ?? data_get($product, 'sourcing_trade.min_order_quantity_sourcing') ?? data_get($product, 'wholesale_trade.min_order_quantity') ?? 1),
                'unit_price' => $product['unit_price'] ?? $product['price'] ?? data_get($tradeInfo, 'price.range_price.min_price') ?? data_get($tradeInfo, 'price.tiered_price.0.price') ?? data_get($product, 'sourcing_trade.fob_min_price') ?? data_get($product, 'wholesale_trade.price') ?? null,
                'currency_code' => $product['currency_code'] ?? $product['currency'] ?? data_get($tradeInfo, 'price.currency') ?? data_get($product, 'sourcing_trade.fob_currency') ?? $account->currency_code,
                'available_quantity' => $product['available_quantity'] ?? $product['quantity'] ?? $tradeInfo['inventory'] ?? data_get($product, 'sourcing_trade.supply_quantity') ?? data_get($product, 'wholesale_trade.volume') ?? null,
                'lead_time_days' => $product['lead_time_days'] ?? data_get($logisticsInfo, 'tiered_lead_time.0.lead_time') ?? data_get($product, 'wholesale_trade.handling_time') ?? null,
                'variant_attributes_json' => [],
                'logistics_modes_json' => Arr::wrap($product['logistics_modes_json'] ?? []),
                'sku_payload_json' => [],
            ];
        }

        return [
            'supplier_account_id' => $account->id,
            'external_product_id' => $externalProductId,
            'external_offer_id' => $externalOfferId,
            'title' => (string) $title,
            'supplier_name' => $product['supplier_name'] ?? $product['seller_name'] ?? $product['shop_name'] ?? $product['owner_member_display_name'] ?? $basicInfo['owner_ali_id'] ?? $account->label,
            'source_url' => $product['source_url'] ?? $product['detail_url'] ?? $product['detailUrl'] ?? $product['pc_detail_url'] ?? null,
            'main_image_url' => $mainImageUrl,
            'category_path_json' => Arr::wrap($product['category_path_json'] ?? $product['categoryPath'] ?? $categoryInfo['category_path'] ?? $categoryInfo['category_name'] ?? []),
            'attributes_json' => $product['attributes_json'] ?? $product['attributes'] ?? $categoryInfo['attributes'] ?? data_get($product, 'product_sku.sku_attributes') ?? [],
            'product_payload_json' => $payload,
            'skus' => $normalizedSkus,
        ];
    }

    private function normalizeAliExpressDsProductResponse(SupplierAccount $account, string $externalProductId, array $payload, string $methodName, array $options = []): array
    {
        $result = is_array($payload['result'] ?? null) ? $payload['result'] : [];
        $baseInfo = is_array($result['ae_item_base_info_dto'] ?? null) ? $result['ae_item_base_info_dto'] : [];
        $storeInfo = is_array($result['ae_store_info'] ?? null) ? $result['ae_store_info'] : [];
        $packageInfo = is_array($result['package_info_dto'] ?? null) ? $result['package_info_dto'] : [];
        $logisticsInfo = is_array($result['logistics_info_dto'] ?? null) ? $result['logistics_info_dto'] : [];
        $productConverter = is_array($result['product_id_converter_result'] ?? null) ? $result['product_id_converter_result'] : [];
        $multimedia = is_array($result['ae_multimedia_info_dto'] ?? null) ? $result['ae_multimedia_info_dto'] : [];

        $title = trim((string) ($baseInfo['subject'] ?? $baseInfo['title'] ?? '')) ?: ('Produit ' . $externalProductId);
        $imageUrlsRaw = trim((string) ($multimedia['image_urls'] ?? ''));
        $imageUrls = array_values(array_filter(array_map('trim', explode(';', $imageUrlsRaw))));
        $mainImageUrl = $imageUrls[0] ?? null;
        $targetCurrency = strtoupper(trim((string) ($options['target_currency'] ?? 'USD'))) ?: 'USD';
        $sourceUrl = $externalProductId !== '' ? 'https://www.aliexpress.com/item/' . $externalProductId . '.html' : null;

        $skuRows = Arr::wrap($result['ae_item_sku_info_dtos'] ?? []);
        $normalizedSkus = array_values(array_filter(array_map(function ($sku) use ($targetCurrency) {
            if (!is_array($sku)) {
                return null;
            }

            $externalSkuId = trim((string) ($sku['sku_id'] ?? $sku['id'] ?? ''));
            if ($externalSkuId === '') {
                return null;
            }

            $price = $this->normalizeMoney($sku['offer_sale_price'] ?? $sku['sku_price'] ?? null);
            $originalPrice = $this->normalizeMoney($sku['offer_bulk_sale_price'] ?? $sku['wholesale_price_tiers'][0]['wholesale_price'] ?? $price);
            $currencyCode = strtoupper(trim((string) ($sku['currency_code'] ?? $sku['target_sale_price_currency'] ?? $targetCurrency))) ?: $targetCurrency;
            $variantAttributes = array_values(array_filter(array_map(function ($property) {
                if (!is_array($property)) {
                    return null;
                }

                return array_filter([
                    'property_id' => $property['sku_property_id'] ?? null,
                    'property_value_id' => $property['property_value_id'] ?? null,
                    'property_name' => $property['sku_property_name'] ?? null,
                    'property_value' => $property['property_value_definition_name'] ?? $property['sku_property_value'] ?? null,
                    'sku_image' => $property['sku_image'] ?? null,
                ], static fn ($value) => $value !== null && $value !== '');
            }, Arr::wrap($sku['ae_sku_property_dtos'] ?? []))));

            return [
                'external_sku_id' => $externalSkuId,
                'sku_label' => $sku['sku_attr'] ?? $sku['id'] ?? $externalSkuId,
                'variant_attributes_json' => $variantAttributes,
                'moq' => max(1, (int) ($sku['sku_bulk_order'] ?? 1)),
                'unit_price' => $price,
                'currency_code' => $currencyCode,
                'available_quantity' => $sku['sku_available_stock'] ?? $sku['ipm_sku_stock'] ?? null,
                'lead_time_days' => null,
                'logistics_modes_json' => [],
                'sku_payload_json' => array_merge($sku, [
                    'original_price' => $originalPrice,
                ]),
                'is_active' => filter_var($sku['sku_stock'] ?? true, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) !== false,
            ];
        }, $skuRows)));

        if ($normalizedSkus === []) {
            $normalizedSkus[] = [
                'external_sku_id' => $externalProductId . '-default',
                'sku_label' => 'Default',
                'variant_attributes_json' => [],
                'moq' => 1,
                'unit_price' => null,
                'currency_code' => $targetCurrency,
                'available_quantity' => null,
                'lead_time_days' => null,
                'logistics_modes_json' => [],
                'sku_payload_json' => [],
                'is_active' => true,
            ];
        }

        $firstSku = $normalizedSkus[0] ?? [];
        $firstSkuPayload = is_array($firstSku['sku_payload_json'] ?? null) ? $firstSku['sku_payload_json'] : [];

        return [
            'supplier_account_id' => $account->id,
            'external_product_id' => $externalProductId,
            'external_offer_id' => $productConverter['main_product_id'] ?? null,
            'title' => $title,
            'supplier_name' => $storeInfo['store_name'] ?? $account->label,
            'source_url' => $sourceUrl,
            'main_image_url' => $mainImageUrl,
            'category_path_json' => array_values(array_filter([
                trim((string) ($baseInfo['category_sequence'] ?? '')),
                trim((string) ($baseInfo['category_id'] ?? '')),
            ])),
            'attributes_json' => [
                'target_currency' => $targetCurrency,
                'target_language' => $options['target_language'] ?? null,
                'ship_to_country' => $options['ship_to_country'] ?? null,
                'avg_evaluation_rating' => $baseInfo['avg_evaluation_rating'] ?? null,
                'sales_count' => $baseInfo['sales_count'] ?? null,
                'evaluation_count' => $baseInfo['evaluation_count'] ?? null,
                'product_status_type' => $baseInfo['product_status_type'] ?? null,
                'delivery_time' => $logisticsInfo['delivery_time'] ?? null,
                'package_length' => $packageInfo['package_length'] ?? null,
                'package_width' => $packageInfo['package_width'] ?? null,
                'package_height' => $packageInfo['package_height'] ?? null,
                'gross_weight' => $packageInfo['gross_weight'] ?? null,
                'has_whole_sale' => $result['has_whole_sale'] ?? null,
                'import_mode' => $methodName === (string) ($this->platformConfig($account->platform)['ds_product_wholesale_get_method'] ?? '') ? 'ds_wholesale' : 'ds_product',
            ],
            'product_payload_json' => $payload,
            'skus' => $normalizedSkus,
            '_storefront_defaults' => [
                'source_currency' => $firstSku['currency_code'] ?? $targetCurrency,
                'source_unit_price' => $firstSku['unit_price'] ?? null,
                'source_original_price' => $firstSkuPayload['original_price'] ?? null,
                'main_image_url' => $mainImageUrl,
                'source_url' => $sourceUrl,
                'estimated_weight_grams' => (int) round(((float) ($packageInfo['gross_weight'] ?? 0)) * 1000),
                'estimated_cbm' => $this->estimateCbmFromPackageInfo($packageInfo),
                'source_logistics_profile' => 'ordinary',
            ],
        ];
    }

    private function normalizeSearchResponse(array $payload): array
    {
        $items = $payload['product_info'] ?? data_get($payload, 'result.products') ?? [];

        return array_values(array_filter(array_map(function ($product) {
            if (!is_array($product)) {
                return null;
            }

            $basicInfo = is_array($product['basic_info'] ?? null) ? $product['basic_info'] : [];
            $tradeInfo = is_array($product['trade_info'] ?? null) ? $product['trade_info'] : [];
            $categoryInfo = is_array($product['category_info'] ?? null) ? $product['category_info'] : [];
            $skuInfo = $product['sku_info'] ?? $tradeInfo['sku_info'] ?? [];

            return [
                'external_product_id' => (string) ($basicInfo['product_id'] ?? $product['id'] ?? ''),
                'title' => $basicInfo['title'] ?? $product['title'] ?? $product['subject'] ?? null,
                'model_number' => $basicInfo['model_number'] ?? null,
                'status' => $basicInfo['status'] ?? $basicInfo['audit_status'] ?? $product['status'] ?? null,
                'main_image_url' => data_get($basicInfo, 'product_images.0.image_url') ?? data_get($product, 'main_image.images.0') ?? null,
                'category_name' => $categoryInfo['category_name'] ?? null,
                'sku_code' => data_get($skuInfo, '0.sku_code'),
                'raw' => $product,
            ];
        }, (array) $items)));
    }

    private function normalizeVideoUploadResponse(array $response): array
    {
        $model = data_get($response, 'result.model', []);

        return [
            'request_id' => $model['req_id'] ?? null,
            'request_status' => $model['req_code'] ?? null,
            'video_id' => $model['video_id'] ?? null,
            'msg_code' => data_get($response, 'result.msg_code'),
            'message' => data_get($response, 'result.msg_info'),
            'raw' => $response,
        ];
    }

    private function normalizeBuyerResult(array $response): array
    {
        return [
            'result_code' => data_get($response, 'result.result_code'),
            'message' => data_get($response, 'result.result_msg'),
            'data' => data_get($response, 'result.result_data'),
            'raw' => $response,
        ];
    }

    private function normalizeBuyerEcoOperationResult(string $operation, array $response): array
    {
        $result = $response['result'] ?? [];
        $data = $result['result_data'] ?? $result['data'] ?? [];

        return match ($operation) {
            'product-description' => [
                'result_code' => $result['result_code'] ?? null,
                'message' => $result['result_msg'] ?? null,
                'summary' => [
                    'product_id' => $data['product_id'] ?? null,
                    'title' => $data['title'] ?? null,
                    'supplier' => $data['supplier'] ?? null,
                    'status' => $data['status'] ?? null,
                    'currency' => $data['currency'] ?? null,
                    'main_image' => $data['main_image'] ?? null,
                    'detail_url' => $data['detail_url'] ?? null,
                    'video_url' => $data['video_url'] ?? null,
                    'min_order_quantity' => $data['min_order_quantity'] ?? null,
                ],
                'data' => $data,
                'raw' => $response,
            ],
            'product-search', 'item-rec', 'item-rec-image' => [
                'result_code' => $result['result_code'] ?? $result['code'] ?? null,
                'message' => $result['result_msg'] ?? $result['message'] ?? null,
                'pagination' => data_get($data, 'pagination'),
                'products' => data_get($data, 'products', []),
                'raw' => $response,
            ],
            'product-cert' => [
                'result_code' => $result['result_code'] ?? null,
                'message' => $result['result_msg'] ?? null,
                'certificates' => is_array($data) ? $data : [],
                'raw' => $response,
            ],
            'product-keyattributes' => [
                'result_code' => $result['result_code'] ?? null,
                'message' => $result['result_msg'] ?? null,
                'attributes' => data_get($data, 'attributes', []),
                'raw' => $response,
            ],
            'product-inventory' => [
                'result_code' => $result['result_code'] ?? null,
                'message' => $result['result_msg'] ?? null,
                'inventories' => is_array($data) ? $data : [],
                'raw' => $response,
            ],
            'crossborder-check', 'local-check', 'localregular-check', 'product-check' => [
                'result_code' => $result['result_code'] ?? null,
                'message' => $result['result_msg'] ?? null,
                'product_ids' => is_array($data) ? $data : [],
                'total' => $result['result_total'] ?? null,
                'raw' => $response,
            ],
            'product-events', 'channel-batch-import' => [
                'result_code' => $result['result_code'] ?? null,
                'message' => $result['result_message'] ?? $result['result_msg'] ?? null,
                'data' => $data,
                'raw' => $response,
            ],
            default => [
                'result_code' => $result['result_code'] ?? null,
                'message' => $result['result_msg'] ?? $result['message'] ?? null,
                'data' => $data,
                'raw' => $response,
            ],
        };
    }

    private function normalizeIopOperationResult(string $operation, array $response): array
    {
        return match ($operation) {
            'advanced-freight-calculate', 'basic-freight-calculate' => [
                'value' => $response['value'] ?? [],
                'raw' => $response,
            ],
            'ds-order-create' => [
                'result' => $response['result'] ?? data_get($response, 'value.result') ?? null,
                'code' => $response['code'] ?? null,
                'request_id' => $response['request_id'] ?? null,
                'raw' => $response,
            ],
            'ds-trade-order-get' => [
                'result' => $response['result'] ?? null,
                'code' => $response['code'] ?? null,
                'request_id' => $response['request_id'] ?? null,
                'raw' => $response,
            ],
            'ds-order-tracking-get' => [
                'result' => $response['result'] ?? null,
                'code' => $response['code'] ?? null,
                'request_id' => $response['request_id'] ?? null,
                'raw' => $response,
            ],
            'ds-product-get' => [
                'result' => $response['result'] ?? null,
                'code' => $response['code'] ?? null,
                'request_id' => $response['request_id'] ?? null,
                'raw' => $response,
            ],
            'ds-product-wholesale-get' => [
                'result' => $response['result'] ?? null,
                'code' => $response['code'] ?? null,
                'request_id' => $response['request_id'] ?? null,
                'raw' => $response,
            ],
            'ds-image-search-v2' => [
                'result' => $response['result'] ?? data_get($response, 'aliexpress_ds_image_searchV2_response.result') ?? null,
                'products' => data_get($response, 'result.data.products')
                    ?? data_get($response, 'result.data')
                    ?? data_get($response, 'aliexpress_ds_image_searchV2_response.result.data.products')
                    ?? data_get($response, 'aliexpress_ds_image_searchV2_response.result.data')
                    ?? [],
                'code' => $response['code'] ?? data_get($response, 'result.code') ?? data_get($response, 'aliexpress_ds_image_searchV2_response.result.code') ?? null,
                'request_id' => $response['request_id'] ?? data_get($response, 'aliexpress_ds_image_searchV2_response.request_id') ?? null,
                'raw' => $response,
            ],
            'ds-category-get' => [
                'result' => $response['result'] ?? null,
                'code' => $response['code'] ?? null,
                'request_id' => $response['request_id'] ?? null,
                'raw' => $response,
            ],
            'ds-feed-itemids-get' => [
                'result' => $response['result'] ?? null,
                'code' => $response['code'] ?? null,
                'request_id' => $response['request_id'] ?? null,
                'raw' => $response,
            ],
            'buyer-freight-calculate' => [
                'result' => $response['result'] ?? null,
                'code' => $response['code'] ?? null,
                'request_id' => $response['request_id'] ?? null,
                'raw' => $response,
            ],
            'merge-pay-query', 'buynow-order-create', 'dropshipping-order-pay', 'order-fund-query', 'order-get', 'order-list', 'order-pay-result-query', 'order-logistics-query', 'seller-warehouse-list' => [
                'value' => $response['value'] ?? $response['response'] ?? null,
                'raw' => $response,
            ],
            'logistics-tracking-get' => [
                'tracking_list' => $response['tracking_list'] ?? [],
                'raw' => $response,
            ],
            'overseas-admittance-check', 'ggs-warehouse-list' => [
                'result' => $response['result'] ?? null,
                'raw' => $response,
            ],
            'order-cancel' => [
                'value' => $response['value'] ?? [],
                'raw' => $response,
            ],
            'ae-affiliate-product-shipping' => [
                'shipping' => data_get($response, 'resp_result.result', []),
                'raw' => $response,
            ],
            'ae-affiliate-sku-detail', 'ae-affiliate-product-detail', 'ae-affiliate-product-query', 'ae-affiliate-hotproduct-query', 'ae-affiliate-hotproduct-download', 'ae-affiliate-product-smartmatch' => [
                'result' => data_get($response, 'result.result') ?? data_get($response, 'resp_result.result') ?? data_get($response, 'result') ?? [],
                'raw' => $response,
            ],
            'ae-affiliate-category-get', 'ae-affiliate-link-generate', 'ae-affiliate-order-get', 'ae-affiliate-order-list', 'ae-affiliate-order-listbyindex' => [
                'result' => data_get($response, 'resp_result.result', []),
                'raw' => $response,
            ],
            'ae-invoice-request-query', 'ae-invoice-result-push', 'ae-fund-recipet-flowdetail-query', 'ae-freight-seller-intention-query', 'ae-freight-isv-gray-query' => [
                'data' => $response['data'] ?? null,
                'success' => $response['succeeded'] ?? $response['success'] ?? null,
                'errorCode' => $response['errorCode'] ?? $response['error_code'] ?? null,
                'errorMessage' => $response['errorMsg'] ?? $response['error'] ?? null,
                'raw' => $response,
            ],
            'ae-fund-merchant-orderdetail', 'ae-brazil-invoice-query', 'ae-hscode-regulatory-attributes-query', 'ae-hscode-regulatory-attributes-options', 'ae-customize-product-info-query', 'ae-customize-product-template-query', 'ae-customize-product-info-audit-result-query', 'ae-customize-product-info-create', 'ae-category-child-attributes-query', 'ae-category-tree-list', 'ae-category-item-qualification-list', 'ae-category-cascade-properties-query', 'ae-solution-sku-attribute-query', 'ae-seller-category-tree-query', 'ae-category-qualifications-list', 'ae-freight-template-recommend', 'ae-freight-template-create', 'ae-solution-order-receiptinfo-get', 'ae-solution-order-get', 'ae-asf-local-supply-platform-logistics-document-query', 'ae-asf-local-supply-platform-logistics-rts', 'ae-asf-local-supply-platform-logistics-repack', 'ae-asf-local-supply-seller-address-get' => [
                'result' => $response['result'] ?? null,
                'raw' => $response,
            ],
            'ae-brazil-invoice-upload', 'ae-fund-recipet-config-query', 'ae-fund-recipet-debt-query', 'ae-freight-template-list' => [
                'result' => $response['result'] ?? null,
                'data' => $response['data'] ?? null,
                'success' => $response['success'] ?? null,
                'raw' => $response,
            ],
            'ae-local-cb-product-prices-edit', 'ae-local-cb-product-status-update', 'ae-local-cb-product-edit', 'ae-local-cb-products-list', 'ae-local-cb-product-post', 'ae-local-cb-products-stock-edit', 'ae-local-cb-product-query' => [
                'success' => $response['success'] ?? data_get($response, 'result.is_success') ?? null,
                'error_code' => $response['error_code'] ?? data_get($response, 'result.error_code') ?? null,
                'error_message' => $response['error_message'] ?? data_get($response, 'result.error_message') ?? null,
                'data' => $response['local_cb_product_dto'] ?? $response['product_list'] ?? $response['product_id'] ?? $response['result'] ?? null,
                'raw' => $response,
            ],
            'ae-trade-order-decrypt' => [
                'result_code' => $response['result_code'] ?? null,
                'result_info' => $response['result_info'] ?? null,
                'result_obj' => $response['result_obj'] ?? null,
                'raw' => $response,
            ],
            'ae-trade-verifycode', 'ae-trade-confirmshippingmode', 'ae-trade-sendcode' => [
                'success' => $response['is_success'] ?? null,
                'error_code' => $response['error_code'] ?? null,
                'message' => $response['memo'] ?? null,
                'raw' => $response,
            ],
            'ae-asf-local2local-sub-declareship', 'ae-asf-local2local-self-pickup-declareship', 'ae-asf-local2local-split-quantity-rts-pack', 'ae-asf-local2local-transfer-to-offline' => [
                'success' => $response['success'] ?? null,
                'errorCode' => $response['errorCode'] ?? null,
                'errorMessage' => $response['errorMessage'] ?? null,
                'data' => $response['data'] ?? null,
                'raw' => $response,
            ],
            'ae-asf-local-supply-shipping-service-get', 'ae-asf-local-supply-batch-declareship', 'ae-asf-local-supply-declareship-modify', 'ae-asf-local-supply-sub-declareship', 'ae-asf-local-supply-split-quantity-rts-pack' => [
                'success' => $response['success'] ?? null,
                'errorCode' => $response['errorCode'] ?? null,
                'errorMessage' => $response['errorMessage'] ?? null,
                'data' => $response['data'] ?? null,
                'raw' => $response,
            ],
            'ae-asf-dbs-declareship', 'ae-asf-dbs-declare-ship-modify', 'ae-asf-shipment-pack', 'ae-asf-order-shipping-service-get', 'ae-asf-package-shipping-service-get', 'ae-asf-platform-logistics-document-query', 'ae-asf-platform-logistics-rts', 'ae-asf-platform-logistics-repack', 'ae-asf-local-unreachable-preference-query', 'ae-asf-seller-address-get', 'ae-asf-local-unreachable-preference-update', 'ae-asf-fulfillment-package-query', 'ae-local-service-products-list' => [
                'result' => $response['result'] ?? null,
                'raw' => $response,
            ],
            'ae-local-service-product-stocks-update', 'ae-local-service-product-stocks-query', 'ae-local-service-product-prices-edit', 'ae-local-service-product-post', 'ae-local-service-product-edit', 'ae-local-service-product-query', 'ae-local-service-product-status-update' => [
                'success' => $response['success'] ?? null,
                'error_code' => $response['error_code'] ?? null,
                'error_message' => $response['error_message'] ?? $response['errorMessage'] ?? null,
                'data' => $response['local_service_product_dto'] ?? $response['product_sku_stock_list'] ?? $response['product_id'] ?? null,
                'raw' => $response,
            ],
            default => [
                'raw' => $response,
            ],
        };
    }

    private function normalizeEcoParams(array $params): array
    {
        $normalized = [];

        foreach ($params as $key => $value) {
            if ($value === null || $value === '') {
                continue;
            }

            $normalized[$key] = is_array($value)
                ? json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                : $value;
        }

        ksort($normalized);

        return $normalized;
    }

    private function normalizeIopParams(array $params): array
    {
        $normalized = [];

        foreach ($params as $key => $value) {
            if ($value === null || $value === '') {
                continue;
            }

            $normalized[$key] = is_array($value)
                ? json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                : $value;
        }

        return $normalized;
    }

    private function normalizeTopFileParams(mixed $fileParams): array
    {
        if (!is_array($fileParams)) {
            return [];
        }

        $normalized = [];

        foreach ($fileParams as $paramName => $definition) {
            if (!is_string($paramName) || $paramName === '' || !is_array($definition)) {
                continue;
            }

            $contentBase64 = $definition['content_base64'] ?? $definition['base64'] ?? null;
            if (!is_string($contentBase64) || $contentBase64 === '') {
                continue;
            }

            $binary = base64_decode($contentBase64, true);
            if ($binary === false) {
                throw new \RuntimeException('Le fichier fourni pour ' . $paramName . ' doit etre un base64 valide.');
            }

            $fileName = (string) ($definition['file_name'] ?? $definition['filename'] ?? $paramName);
            $normalized[] = [
                'name' => $paramName,
                'contents' => $binary,
                'filename' => $fileName,
            ];
        }

        return $normalized;
    }

    private function sendTopPostRequest(
        PendingRequest $request,
        string $url,
        array $commonParams,
        array $businessParams,
        array $fileParams
    ) {
        $targetUrl = $url . '?' . Arr::query($commonParams);

        if ($fileParams === []) {
            return $request->asForm()->post($targetUrl, $businessParams);
        }

        foreach ($fileParams as $fileParam) {
            $request = $request->attach($fileParam['name'], $fileParam['contents'], $fileParam['filename']);
        }

        return $request->post($targetUrl, $businessParams);
    }

    private function signEcoRequest(string $methodName, array $params, string $secret, string $signMethod): string
    {
        $signPayload = $methodName;
        foreach ($params as $key => $value) {
            $signPayload .= $key . $value;
        }

        $algorithm = Str::lower($signMethod) === 'sha256' ? 'sha256' : 'md5';

        return strtoupper(hash_hmac($algorithm, $signPayload, $secret));
    }

    private function buyerEcoOperationDefinitions(): array
    {
        return [
            'product-events' => ['config_key' => 'buyer_product_events_method', 'http_method' => 'POST', 'param_key' => 'query_req'],
            'channel-batch-import' => ['config_key' => 'buyer_product_channel_batch_import_method', 'http_method' => 'POST', 'param_key' => 'query_req'],
            'crossborder-check' => ['config_key' => 'buyer_crossborder_product_check_method', 'http_method' => 'GET', 'param_key' => 'param0'],
            'product-cert' => ['config_key' => 'buyer_product_cert_method', 'http_method' => 'GET', 'param_key' => 'req'],
            'product-description' => ['config_key' => 'buyer_product_description_method', 'http_method' => 'GET', 'param_key' => 'query_req'],
            'product-keyattributes' => ['config_key' => 'buyer_product_keyattributes_method', 'http_method' => 'GET', 'param_key' => 'query_req'],
            'product-inventory' => ['config_key' => 'buyer_product_inventory_method', 'http_method' => 'GET', 'param_key' => 'inv_req'],
            'local-check' => ['config_key' => 'buyer_local_product_check_method', 'http_method' => 'GET', 'param_key' => 'req'],
            'localregular-check' => ['config_key' => 'buyer_localregular_product_check_method', 'http_method' => 'GET', 'param_key' => 'req'],
            'item-rec-image' => ['config_key' => 'buyer_item_rec_image_method', 'http_method' => 'GET', 'param_key' => 'recReq'],
            'product-check' => ['config_key' => 'buyer_product_check_method', 'http_method' => 'GET', 'param_key' => 'query_req'],
            'product-search' => ['config_key' => 'buyer_product_search_method', 'http_method' => 'GET', 'param_key' => 'param0'],
            'item-rec' => ['config_key' => 'buyer_item_rec_method', 'http_method' => 'GET', 'param_key' => 'recReq'],
        ];
    }

    private function iopOperationDefinitions(): array
    {
        return [
            'advanced-freight-calculate' => ['config_key' => 'advanced_freight_calculate_method', 'http_method' => 'POST', 'param_key' => null],
            'basic-freight-calculate' => ['config_key' => 'basic_freight_calculate_method', 'http_method' => 'POST', 'param_key' => null],
            'ds-order-create' => ['config_key' => 'ds_order_create_method', 'http_method' => 'POST', 'param_key' => null],
            'ds-product-get' => ['config_key' => 'ds_product_get_method', 'http_method' => 'POST', 'param_key' => null],
            'ds-product-wholesale-get' => ['config_key' => 'ds_product_wholesale_get_method', 'http_method' => 'POST', 'param_key' => null],
            'ds-image-search-v2' => ['config_key' => 'ds_image_search_v2_method', 'http_method' => 'POST', 'param_key' => 'param0'],
            'ds-category-get' => ['config_key' => 'ds_category_get_method', 'http_method' => 'POST', 'param_key' => null],
            'ds-feed-itemids-get' => ['config_key' => 'ds_feed_itemids_get_method', 'http_method' => 'POST', 'param_key' => null],
            'buyer-freight-calculate' => ['config_key' => 'buyer_freight_calculate_method', 'http_method' => 'POST', 'param_key' => null],
            'ds-trade-order-get' => ['config_key' => 'ds_trade_order_get_method', 'http_method' => 'POST', 'param_key' => null],
            'ds-order-tracking-get' => ['config_key' => 'ds_order_tracking_get_method', 'http_method' => 'POST', 'param_key' => null],
            'merge-pay-query' => ['config_key' => 'merge_pay_query_method', 'http_method' => 'POST', 'param_key' => 'order_ids'],
            'buynow-order-create' => ['config_key' => 'buynow_order_create_method', 'http_method' => 'POST', 'param_key' => null],
            'logistics-tracking-get' => ['config_key' => 'logistics_tracking_get_method', 'http_method' => 'POST', 'param_key' => 'trade_id'],
            'overseas-admittance-check' => ['config_key' => 'overseas_admittance_check_method', 'http_method' => 'POST', 'param_key' => null],
            'dropshipping-order-pay' => ['config_key' => 'dropshipping_order_pay_method', 'http_method' => 'POST', 'param_key' => 'param_order_pay_request'],
            'order-fund-query' => ['config_key' => 'order_fund_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ggs-warehouse-list' => ['config_key' => 'ggs_warehouse_list_method', 'http_method' => 'POST', 'param_key' => null],
            'order-cancel' => ['config_key' => 'order_cancel_method', 'http_method' => 'POST', 'param_key' => 'trade_id'],
            'order-get' => ['config_key' => 'order_get_method', 'http_method' => 'POST', 'param_key' => null],
            'order-list' => ['config_key' => 'order_list_method', 'http_method' => 'POST', 'param_key' => null],
            'order-pay-result-query' => ['config_key' => 'order_pay_result_query_method', 'http_method' => 'POST', 'param_key' => 'trade_id'],
            'seller-warehouse-list' => ['config_key' => 'seller_warehouse_list_method', 'http_method' => 'POST', 'param_key' => null],
            'order-logistics-query' => ['config_key' => 'order_logistics_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-affiliate-product-shipping' => ['config_key' => 'affiliate_shipping_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-affiliate-sku-detail' => ['config_key' => 'affiliate_sku_detail_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-affiliate-product-detail' => ['config_key' => 'affiliate_product_detail_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-affiliate-product-query' => ['config_key' => 'affiliate_product_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-affiliate-category-get' => ['config_key' => 'affiliate_category_get_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-affiliate-link-generate' => ['config_key' => 'affiliate_link_generate_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-affiliate-order-get' => ['config_key' => 'affiliate_order_get_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-affiliate-order-list' => ['config_key' => 'affiliate_order_list_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-affiliate-order-listbyindex' => ['config_key' => 'affiliate_order_listbyindex_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-affiliate-hotproduct-query' => ['config_key' => 'affiliate_hotproduct_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-affiliate-hotproduct-download' => ['config_key' => 'affiliate_hotproduct_download_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-affiliate-product-smartmatch' => ['config_key' => 'affiliate_product_smartmatch_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-invoice-request-query' => ['config_key' => 'seller_invoicing_apply_info_get_method', 'http_method' => 'POST', 'param_key' => 'param0'],
            'ae-fund-merchant-orderdetail' => ['config_key' => 'fund_merchant_orderdetail_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-brazil-invoice-query' => ['config_key' => 'brazil_invoice_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-brazil-invoice-upload' => ['config_key' => 'brazil_invoice_upload_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-invoice-result-push' => ['config_key' => 'seller_invoicing_result_push_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-hscode-regulatory-attributes-query' => ['config_key' => 'hscode_query_regulatory_attributes_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-hscode-regulatory-attributes-options' => ['config_key' => 'hscode_select_regulatory_attributes_options_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-fund-recipet-flowdetail-query' => ['config_key' => 'fund_recipet_flowdetail_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-fund-recipet-config-query' => ['config_key' => 'fund_recipet_config_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-fund-recipet-debt-query' => ['config_key' => 'fund_recipet_debt_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-customize-product-info-query' => ['config_key' => 'customize_product_info_query_method', 'http_method' => 'GET', 'param_key' => 'param0'],
            'ae-customize-product-template-query' => ['config_key' => 'customize_product_template_query_method', 'http_method' => 'GET', 'param_key' => 'param0'],
            'ae-customize-product-info-audit-result-query' => ['config_key' => 'customize_product_info_audit_result_query_method', 'http_method' => 'GET', 'param_key' => 'param0'],
            'ae-customize-product-info-create' => ['config_key' => 'customize_product_info_create_method', 'http_method' => 'POST', 'param_key' => 'param0'],
            'ae-local-cb-product-prices-edit' => ['config_key' => 'local_cb_product_prices_edit_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-local-cb-product-status-update' => ['config_key' => 'local_cb_product_status_update_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-local-cb-product-edit' => ['config_key' => 'local_cb_product_edit_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-local-cb-products-list' => ['config_key' => 'local_cb_products_list_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-local-cb-product-post' => ['config_key' => 'local_cb_product_post_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-local-cb-products-stock-edit' => ['config_key' => 'local_cb_products_stock_edit_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-local-cb-product-query' => ['config_key' => 'local_cb_product_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-category-child-attributes-query' => ['config_key' => 'category_child_attributes_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-category-tree-list' => ['config_key' => 'category_tree_list_method', 'http_method' => 'GET', 'param_key' => null],
            'ae-category-item-qualification-list' => ['config_key' => 'category_item_qualification_list_method', 'http_method' => 'GET', 'param_key' => null],
            'ae-category-cascade-properties-query' => ['config_key' => 'category_cascade_properties_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-solution-sku-attribute-query' => ['config_key' => 'solution_sku_attribute_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-seller-category-tree-query' => ['config_key' => 'seller_category_tree_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-category-qualifications-list' => ['config_key' => 'category_qualifications_list_method', 'http_method' => 'GET', 'param_key' => null],
            'ae-freight-seller-intention-query' => ['config_key' => 'freight_seller_intention_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-freight-isv-gray-query' => ['config_key' => 'freight_isv_gray_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-freight-template-recommend' => ['config_key' => 'freight_template_recommend_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-freight-template-create' => ['config_key' => 'freight_template_create_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-freight-template-list' => ['config_key' => 'freight_template_list_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-trade-order-decrypt' => ['config_key' => 'trade_order_decrypt_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-solution-order-receiptinfo-get' => ['config_key' => 'solution_order_receiptinfo_get_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-solution-order-get' => ['config_key' => 'solution_order_get_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-trade-verifycode' => ['config_key' => 'trade_verifycode_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-trade-confirmshippingmode' => ['config_key' => 'trade_confirmshippingmode_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-trade-sendcode' => ['config_key' => 'trade_sendcode_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-local2local-sub-declareship' => ['config_key' => 'asf_local2local_sub_declareship_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-dbs-declareship' => ['config_key' => 'asf_dbs_declareship_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-local2local-self-pickup-declareship' => ['config_key' => 'asf_local2local_self_pickup_declareship_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-dbs-declare-ship-modify' => ['config_key' => 'asf_dbs_declare_ship_modify_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-shipment-pack' => ['config_key' => 'asf_shipment_pack_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-order-shipping-service-get' => ['config_key' => 'asf_order_shipping_service_get_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-package-shipping-service-get' => ['config_key' => 'asf_package_shipping_service_get_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-local2local-split-quantity-rts-pack' => ['config_key' => 'asf_local2local_split_quantity_rts_pack_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-platform-logistics-document-query' => ['config_key' => 'asf_platform_logistics_document_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-platform-logistics-rts' => ['config_key' => 'asf_platform_logistics_rts_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-platform-logistics-repack' => ['config_key' => 'asf_platform_logistics_repack_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-local-unreachable-preference-query' => ['config_key' => 'asf_local_unreachable_preference_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-seller-address-get' => ['config_key' => 'asf_seller_address_get_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-local-unreachable-preference-update' => ['config_key' => 'asf_local_unreachable_preference_update_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-local2local-transfer-to-offline' => ['config_key' => 'asf_local2local_transfer_to_offline_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-fulfillment-package-query' => ['config_key' => 'asf_fulfillment_package_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-local-supply-shipping-service-get' => ['config_key' => 'asf_local_supply_shipping_service_get_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-local-supply-batch-declareship' => ['config_key' => 'asf_local_supply_batch_declareship_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-local-supply-declareship-modify' => ['config_key' => 'asf_local_supply_declareship_modify_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-local-supply-sub-declareship' => ['config_key' => 'asf_local_supply_sub_declareship_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-local-supply-split-quantity-rts-pack' => ['config_key' => 'asf_local_supply_split_quantity_rts_pack_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-local-supply-platform-logistics-document-query' => ['config_key' => 'asf_local_supply_platform_logistics_document_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-local-supply-platform-logistics-rts' => ['config_key' => 'asf_local_supply_platform_logistics_rts_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-local-supply-platform-logistics-repack' => ['config_key' => 'asf_local_supply_platform_logistics_repack_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-asf-local-supply-seller-address-get' => ['config_key' => 'asf_local_supply_seller_address_get_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-local-service-product-stocks-update' => ['config_key' => 'local_service_product_stocks_update_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-local-service-product-stocks-query' => ['config_key' => 'local_service_product_stocks_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-local-service-products-list' => ['config_key' => 'local_service_products_list_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-local-service-product-prices-edit' => ['config_key' => 'local_service_product_prices_edit_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-local-service-product-post' => ['config_key' => 'local_service_product_post_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-local-service-product-edit' => ['config_key' => 'local_service_product_edit_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-local-service-product-query' => ['config_key' => 'local_service_product_query_method', 'http_method' => 'POST', 'param_key' => null],
            'ae-local-service-product-status-update' => ['config_key' => 'local_service_product_status_update_method', 'http_method' => 'POST', 'param_key' => null],
        ];
    }

    private function buildProductLookupParams(string $methodName, string $lookupParam, string $externalProductId, ?string $lookupType = null, array $options = []): array
    {
        if ($methodName === '/icbu/product/get') {
            $resolvedLookupParam = $lookupType === 'sku_id' ? 'skuId' : 'productId';

            return [
                'product_get_request' => json_encode([
                    $resolvedLookupParam => $externalProductId,
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ];
        }

        if ($methodName === '/alibaba/icbu/product/get/v2') {
            $resolvedLookupParam = $lookupType === 'sku_id' ? 'sku_id' : $lookupParam;

            return [
                $resolvedLookupParam => $externalProductId,
            ];
        }

        if ($methodName === 'aliexpress.solution.product.info.get') {
            return [
                'product_id' => $externalProductId,
                'productId' => $externalProductId,
            ];
        }

        if (in_array($methodName, ['aliexpress.ds.product.get', 'aliexpress.ds.product.wholesale.get'], true)) {
            return array_filter([
                'ship_to_country' => strtoupper(trim((string) ($options['ship_to_country'] ?? 'TG'))) ?: 'TG',
                'product_id' => $externalProductId,
                'target_currency' => $this->nullableStringForParams($options['target_currency'] ?? null),
                'target_language' => $this->nullableStringForParams($options['target_language'] ?? null),
                'remove_personal_benefit' => array_key_exists('remove_personal_benefit', $options) ? ($options['remove_personal_benefit'] ? 'true' : 'false') : null,
                'biz_model' => $this->nullableStringForParams($options['biz_model'] ?? null),
                'province_code' => $this->nullableStringForParams($options['province_code'] ?? null),
                'city_code' => $this->nullableStringForParams($options['city_code'] ?? null),
            ], static fn ($value) => $value !== null && $value !== '');
        }

        return [
            'productId' => $lookupType === 'sku_id' ? null : $externalProductId,
            'skuId' => $lookupType === 'sku_id' ? $externalProductId : null,
            $lookupParam => $externalProductId,
            'product_id' => $externalProductId,
            'external_product_id' => $externalProductId,
        ];
    }

    private function usesTopBusinessApi(string $methodName): bool
    {
        return !str_starts_with(trim($methodName), '/');
    }

    private function baseRequest(int $timeout): PendingRequest
    {
        return Http::timeout($timeout)->acceptJson();
    }

    private function platformConfig(string $platform): array
    {
        return (array) data_get(config('services.sourcing.platforms'), $platform, []);
    }

    private function normalizeMoney(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        $normalized = str_replace(['"', ','], ['', '.'], trim((string) $value));
        if ($normalized === '' || !is_numeric($normalized)) {
            return null;
        }

        return (float) $normalized;
    }

    private function estimateCbmFromPackageInfo(array $packageInfo): float
    {
        $length = (float) ($packageInfo['package_length'] ?? 0);
        $width = (float) ($packageInfo['package_width'] ?? 0);
        $height = (float) ($packageInfo['package_height'] ?? 0);

        if ($length <= 0 || $width <= 0 || $height <= 0) {
            return 0.0;
        }

        return round(($length * $width * $height) / 1000000, 6);
    }

    private function nullableStringForParams(mixed $value): ?string
    {
        $normalized = trim((string) ($value ?? ''));
        return $normalized === '' ? null : $normalized;
    }
}