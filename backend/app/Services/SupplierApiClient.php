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
        $methodName = trim((string) ($config['product_detail_method'] ?? $config['product_detail_path'] ?? ''));
        $lookupParam = trim((string) ($config['product_lookup_param'] ?? 'product_id'));
        if ($methodName === '') {
            throw new \RuntimeException('Méthode TOP de détail produit non configurée pour ' . $account->platform);
        }

        $response = $this->request($account, $methodName, [
            $lookupParam => $externalProductId,
            'product_id' => $externalProductId,
            'external_product_id' => $externalProductId,
        ]);

        return $this->normalizeProductResponse($account, $externalProductId, $response);
    }

    public function request(SupplierAccount $account, string $methodName, array $params = []): array
    {
        $config = $this->platformConfig($account->platform);
        $url = trim((string) ($config['api_base_url'] ?? ''));
        if ($url === '') {
            throw new \RuntimeException('Base URL API non configurée pour ' . $account->platform);
        }

        $signMethod = strtolower((string) ($config['top_sign_method'] ?? 'md5'));
        $query = array_filter($params, static fn ($value) => $value !== null && $value !== '');
        $query['method'] = $methodName;
        $query['app_key'] = $account->app_key;
        $query['timestamp'] = now()->timezone('Asia/Shanghai')->format('Y-m-d H:i:s');
        $query['format'] = 'json';
        $query['v'] = (string) ($config['top_version'] ?? '2.0');
        $query['sign_method'] = $signMethod;
        $query['simplify'] = 'true';
        if (!empty($account->access_token)) {
            $query['session'] = $account->access_token;
        }

        $query['sign'] = $this->buildTopSignature($query, (string) ($account->app_secret ?? ''), $signMethod);

        $request = $this->baseRequest((int) ($config['timeout'] ?? 20));
        $response = $request->asForm()->post($url, $query);

        if (!$response->successful()) {
            throw new \RuntimeException('Appel API fournisseur échoué (HTTP ' . $response->status() . '): ' . $response->body());
        }

        $payload = $response->json() ?? [];
        if (isset($payload['error_response'])) {
            $error = $payload['error_response'];
            throw new \RuntimeException(($error['sub_msg'] ?? $error['msg'] ?? 'Erreur TOP') . ' [' . ($error['sub_code'] ?? $error['code'] ?? 'unknown') . ']');
        }

        return $payload;
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

    private function buildTopSignature(array $params, string $secret, string $signMethod): string
    {
        unset($params['sign']);
        ksort($params);

        $concatenated = '';
        foreach ($params as $key => $value) {
            if (is_array($value)) {
                $value = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
            if ($value === null || $value === '') {
                continue;
            }
            $concatenated .= $key . (string) $value;
        }

        return match ($signMethod) {
            'hmac', 'hmac-md5' => strtoupper(hash_hmac('md5', $concatenated, $secret)),
            'hmac-sha256' => strtoupper(hash_hmac('sha256', $concatenated, $secret)),
            default => strtoupper(md5($secret . $concatenated . $secret)),
        };
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