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
    public function fetchRemoteProduct(SupplierAccount $account, string $externalProductId, ?string $lookupType = null): array
    {
        $config = $this->platformConfig($account->platform);
        $methodName = trim((string) ($config['product_detail_method'] ?? $config['product_detail_path'] ?? ''));
        $lookupParam = trim((string) ($config['product_lookup_param'] ?? 'product_id'));
        if ($methodName === '') {
            throw new \RuntimeException('Méthode IOP de détail produit non configurée pour ' . $account->platform);
        }

        $response = $this->request($account, $methodName, $this->buildProductLookupParams($methodName, $lookupParam, $externalProductId, $lookupType));

        return $this->normalizeProductResponse($account, $externalProductId, $response);
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

        return $this->gopRequest($account, $httpMethod, $methodName, $params, true, 'Appel IOP');
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

    private function normalizeProductResponse(SupplierAccount $account, string $externalProductId, array $payload): array
    {
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
        ];
    }

    private function buildProductLookupParams(string $methodName, string $lookupParam, string $externalProductId, ?string $lookupType = null): array
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

        return [
            'productId' => $lookupType === 'sku_id' ? null : $externalProductId,
            'skuId' => $lookupType === 'sku_id' ? $externalProductId : null,
            $lookupParam => $externalProductId,
            'product_id' => $externalProductId,
            'external_product_id' => $externalProductId,
        ];
    }

    private function baseRequest(int $timeout): PendingRequest
    {
        return Http::timeout($timeout)->acceptJson();
    }

    private function platformConfig(string $platform): array
    {
        return (array) data_get(config('services.sourcing.platforms'), $platform, []);
    }
}