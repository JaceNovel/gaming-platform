<?php

namespace App\Services;

use App\Models\SupplierAccount;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;

class SupplierApiClient
{
    public function fetchRemoteProduct(SupplierAccount $account, string $externalProductId): array
    {
        $config = $this->platformConfig($account->platform);
        $path = trim((string) ($config['product_detail_path'] ?? ''));
        $lookupParam = trim((string) ($config['product_lookup_param'] ?? 'product_id'));
        if ($path === '') {
            throw new \RuntimeException('Chemin d’API produit non configuré pour ' . $account->platform);
        }

        $response = $this->request($account, 'GET', $path, [
            $lookupParam => $externalProductId,
            'product_id' => $externalProductId,
            'external_product_id' => $externalProductId,
        ]);

        return $this->normalizeProductResponse($account, $externalProductId, $response);
    }

    public function request(SupplierAccount $account, string $method, string $path, array $params = [], array $body = []): array
    {
        $config = $this->platformConfig($account->platform);
        $baseUrl = rtrim((string) ($config['api_base_url'] ?? ''), '/');
        if ($baseUrl === '') {
            throw new \RuntimeException('Base URL API non configurée pour ' . $account->platform);
        }

        $normalizedPath = '/' . ltrim($path, '/');
        $timestamp = (string) round(microtime(true) * 1000);
        $query = array_filter($params, static fn ($value) => $value !== null && $value !== '');
        $query['app_key'] = $account->app_key;
        $query['timestamp'] = $timestamp;
        $query['sign_method'] = 'sha256';
        if (!empty($account->access_token)) {
            $query['access_token'] = $account->access_token;
        }

        $query['sign'] = $this->buildSignature($account, $normalizedPath, $query, $body);

        $request = $this->baseRequest((int) ($config['timeout'] ?? 20));
        $url = $baseUrl . $normalizedPath;
        $upperMethod = strtoupper($method);

        $response = match ($upperMethod) {
            'POST' => $request->post($url, $body + $query),
            default => $request->get($url, $query),
        };

        if (!$response->successful()) {
            throw new \RuntimeException('Appel API fournisseur échoué (HTTP ' . $response->status() . '): ' . $response->body());
        }

        return $response->json() ?? [];
    }

    private function normalizeProductResponse(SupplierAccount $account, string $externalProductId, array $payload): array
    {
        $root = $payload['result'] ?? $payload['data'] ?? $payload['result_data'] ?? $payload;
        $product = is_array($root['product'] ?? null) ? $root['product'] : $root;

        $title = $product['title']
            ?? $product['subject']
            ?? $product['product_title']
            ?? $product['name']
            ?? ('Produit ' . $externalProductId);

        $externalOfferId = $product['offer_id'] ?? $product['offerId'] ?? null;
        $mainImageUrl = $product['main_image_url']
            ?? $product['mainImageUrl']
            ?? $product['image_url']
            ?? data_get($product, 'images.0')
            ?? null;

        $skuRows = $product['skus']
            ?? $product['sku_list']
            ?? $product['skuInfoList']
            ?? $product['productSkuList']
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
                'variant_attributes_json' => $sku['variant_attributes_json'] ?? $sku['attributes'] ?? $sku['specs'] ?? [],
                'moq' => (int) ($sku['moq'] ?? $sku['minOrderQuantity'] ?? 1),
                'unit_price' => $sku['unit_price'] ?? $sku['price'] ?? $sku['offerPrice'] ?? null,
                'currency_code' => $sku['currency_code'] ?? $sku['currency'] ?? $account->currency_code,
                'available_quantity' => $sku['available_quantity'] ?? $sku['quantity'] ?? $sku['inventory'] ?? null,
                'lead_time_days' => $sku['lead_time_days'] ?? $sku['leadTime'] ?? null,
                'logistics_modes_json' => Arr::wrap($sku['logistics_modes_json'] ?? $sku['logisticsModes'] ?? []),
                'sku_payload_json' => $sku,
            ];
        }

        if (empty($normalizedSkus)) {
            $normalizedSkus[] = [
                'external_sku_id' => $externalProductId . '-default',
                'sku_label' => 'Default',
                'moq' => 1,
                'unit_price' => $product['unit_price'] ?? $product['price'] ?? null,
                'currency_code' => $product['currency_code'] ?? $product['currency'] ?? $account->currency_code,
                'available_quantity' => $product['available_quantity'] ?? $product['quantity'] ?? null,
                'lead_time_days' => $product['lead_time_days'] ?? null,
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
            'supplier_name' => $product['supplier_name'] ?? $product['seller_name'] ?? $product['shop_name'] ?? $account->label,
            'source_url' => $product['source_url'] ?? $product['detail_url'] ?? $product['detailUrl'] ?? null,
            'main_image_url' => $mainImageUrl,
            'category_path_json' => Arr::wrap($product['category_path_json'] ?? $product['categoryPath'] ?? []),
            'attributes_json' => $product['attributes_json'] ?? $product['attributes'] ?? [],
            'product_payload_json' => $payload,
            'skus' => $normalizedSkus,
        ];
    }

    private function buildSignature(SupplierAccount $account, string $path, array $query, array $body): string
    {
        $signing = $query;
        unset($signing['sign']);
        ksort($signing);

        $canonical = $path;
        foreach ($signing as $key => $value) {
            if (is_array($value)) {
                $value = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
            $canonical .= $key . (string) $value;
        }

        if (!empty($body)) {
            ksort($body);
            foreach ($body as $key => $value) {
                if (is_array($value)) {
                    $value = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                }
                $canonical .= $key . (string) $value;
            }
        }

        return strtoupper(hash_hmac('sha256', $canonical, (string) ($account->app_secret ?? '')));
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