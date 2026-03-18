<?php

namespace App\Services;

use App\Exceptions\BulkImportDiagnosticException;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductSupplierLink;
use App\Models\SupplierAccount;
use App\Models\SupplierProduct;
use App\Models\SupplierProductSku;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AliExpressBulkCatalogImportService
{
    public function __construct(
        private readonly SupplierApiClient $supplierApiClient,
        private readonly SupplierCatalogImportService $supplierCatalogImportService,
    ) {
    }

    public function import(SupplierAccount $account, array $options): array
    {
        if ((string) $account->platform !== 'aliexpress') {
            throw new \RuntimeException('Le bulk import automatique est reserve aux comptes AliExpress.');
        }

        $operation = (string) ($options['operation'] ?? 'ae-affiliate-hotproduct-download');
        $limit = min(200, max(1, (int) ($options['limit'] ?? 50)));
        $requestPayload = is_array($options['request_payload'] ?? null) ? $options['request_payload'] : [];
        $requestPayload['page_size'] = min($limit, max(1, (int) ($requestPayload['page_size'] ?? $limit)));
        $requestPayload = $this->sanitizeAffiliateRequestPayload($operation, $requestPayload);
        $this->validateAffiliateRequestPayload($operation, $requestPayload);

        try {
            $response = $this->supplierApiClient->iopOperation($account, $operation, $requestPayload);
        } catch (\RuntimeException $exception) {
            $this->throwAffiliatePermissionDiagnosticIfNeeded($operation, $requestPayload, $exception);
            throw $exception;
        }

        $this->throwAffiliateProviderResponseDiagnosticIfNeeded($operation, $requestPayload, $response);

        $rows = array_slice($this->extractAffiliateProductsFromResponse($response), 0, $limit);

        if ($rows === []) {
            throw new BulkImportDiagnosticException(
                'Aucun produit exploitable n\'a ete retourne par l\'operation AliExpress. Verifie les mots-cles, le pays de destination et la structure reponse du provider.',
                $this->buildAffiliateResponseDiagnostic($operation, $requestPayload, $response)
            );
        }

        $autoCreateProducts = (bool) ($options['auto_create_products'] ?? true);
        $publishProducts = (bool) ($options['publish_products'] ?? false);
        $imported = [];
        $createdProducts = [];
        $updatedProducts = [];
        $skippedProducts = [];

        foreach ($rows as $row) {
            $supplierPayload = $this->normalizeAffiliateRow($account, $row, $options);
            if ($supplierPayload === null) {
                continue;
            }

            $supplierProduct = $this->supplierCatalogImportService->import($account->id, $supplierPayload);

            $localSync = null;
            if ($autoCreateProducts) {
                $localSync = $this->syncLocalProduct($supplierProduct, $supplierPayload, $options, $publishProducts);
                if (($localSync['created'] ?? false) && isset($localSync['product'])) {
                    $createdProducts[] = $this->summarizeProduct($localSync['product']);
                } elseif (($localSync['updated'] ?? false) && isset($localSync['product'])) {
                    $updatedProducts[] = $this->summarizeProduct($localSync['product']);
                } elseif (isset($localSync['product'])) {
                    $skippedProducts[] = $this->summarizeProduct($localSync['product']);
                }
            }

            $imported[] = [
                'supplier_product_id' => $supplierProduct->id,
                'external_product_id' => $supplierProduct->external_product_id,
                'title' => $supplierProduct->title,
                'main_image_url' => $supplierProduct->main_image_url,
                'source_url' => $supplierProduct->source_url,
                'supplier_name' => $supplierProduct->supplier_name,
                'skus_count' => $supplierProduct->skus->count(),
                'local_product' => $localSync['product'] ?? null ? $this->summarizeProduct($localSync['product']) : null,
            ];
        }

        $account->forceFill(['last_sync_at' => now(), 'last_error_at' => null, 'last_error_message' => null])->save();

        return [
            'summary' => [
                'operation' => $operation,
                'requested_limit' => $limit,
                'fetched_rows' => count($rows),
                'imported_supplier_products' => count($imported),
                'created_storefront_products' => count($createdProducts),
                'updated_storefront_products' => count($updatedProducts),
                'skipped_storefront_products' => count($skippedProducts),
            ],
            'imported' => $imported,
            'created_products' => array_slice($createdProducts, 0, 25),
            'updated_products' => array_slice($updatedProducts, 0, 25),
            'skipped_products' => array_slice($skippedProducts, 0, 25),
            'raw' => [
                'result_count' => count($rows),
            ],
        ];
    }

    public function syncStorefrontProductFromSupplierImport(SupplierProduct $supplierProduct, array $supplierPayload, array $options = []): array
    {
        $resolvedPayload = $this->ensureStorefrontDefaults($supplierProduct, $supplierPayload, $options);
        $publishProducts = (bool) ($options['publish_products'] ?? false);

        return $this->syncLocalProduct($supplierProduct, $resolvedPayload, $options, $publishProducts);
    }

    private function extractAffiliateProductsFromResponse(array $response): array
    {
        $wrappedRaw = $this->extractAliExpressAffiliateEnvelope($response['raw'] ?? null);

        $candidates = [
            $response['result'] ?? null,
            data_get($response, 'raw.result.result'),
            data_get($response, 'raw.resp_result.result'),
            data_get($wrappedRaw, 'result.result'),
            data_get($wrappedRaw, 'resp_result.result'),
            data_get($response, 'raw.result'),
            data_get($response, 'raw.resp_result'),
            data_get($wrappedRaw, 'result'),
            data_get($wrappedRaw, 'resp_result'),
            $response['raw'] ?? null,
            $wrappedRaw,
        ];

        foreach ($candidates as $candidate) {
            $rows = $this->extractAffiliateProducts($candidate);
            if ($rows !== []) {
                return $rows;
            }
        }

        return [];
    }

    private function buildAffiliateResponseDiagnostic(string $operation, array $requestPayload, array $response): array
    {
        $wrappedRaw = $this->extractAliExpressAffiliateEnvelope($response['raw'] ?? null);
        $providerStatus = $this->extractAffiliateProviderStatus($response);

        $candidateMap = [
            'result' => $response['result'] ?? null,
            'raw.result.result' => data_get($response, 'raw.result.result'),
            'raw.resp_result.result' => data_get($response, 'raw.resp_result.result'),
            'raw.wrapper.result.result' => data_get($wrappedRaw, 'result.result'),
            'raw.wrapper.resp_result.result' => data_get($wrappedRaw, 'resp_result.result'),
            'raw.result' => data_get($response, 'raw.result'),
            'raw.resp_result' => data_get($response, 'raw.resp_result'),
            'raw.wrapper.result' => data_get($wrappedRaw, 'result'),
            'raw.wrapper.resp_result' => data_get($wrappedRaw, 'resp_result'),
            'raw' => $response['raw'] ?? null,
        ];

        $candidateSummaries = [];
        foreach ($candidateMap as $path => $candidate) {
            $candidateSummaries[$path] = $this->summarizeAffiliateNode($candidate);
        }

        return [
            'operation' => $operation,
            'request_payload' => $this->summarizeAffiliateRequestPayload($requestPayload),
            'response_top_level_keys' => array_keys($response),
            'candidate_summaries' => $candidateSummaries,
            'discovered_shapes' => $this->discoverAffiliateShapes($response),
            'provider_status' => $providerStatus,
        ];
    }

    private function summarizeAffiliateRequestPayload(array $requestPayload): array
    {
        return Arr::only($requestPayload, [
            'keywords',
            'category_id',
            'category_ids',
            'fields',
            'ship_to_country',
            'country',
            'target_currency',
            'target_language',
            'page_no',
            'page_size',
            'sort',
            'tracking_id',
        ]);
    }

    private function extractAliExpressAffiliateEnvelope(mixed $raw): ?array
    {
        if (!is_array($raw)) {
            return null;
        }

        foreach ($raw as $key => $value) {
            if (!is_string($key) || !is_array($value)) {
                continue;
            }

            if (preg_match('/^aliexpress_affiliate_.*_response$/', $key) === 1) {
                return $value;
            }
        }

        return null;
    }

    private function throwAffiliatePermissionDiagnosticIfNeeded(string $operation, array $requestPayload, \RuntimeException $exception): void
    {
        if (!str_starts_with($operation, 'ae-affiliate-')) {
            return;
        }

        $message = (string) $exception->getMessage();
        if (!str_contains($message, 'InsufficientPermission')) {
            return;
        }

        throw new BulkImportDiagnosticException(
            'Le compte AliExpress utilise pour le bulk import n\'a pas la permission API Affiliate pour cette operation.',
            [
                'operation' => $operation,
                'request_payload' => Arr::only($requestPayload, [
                    'keywords',
                    'category_id',
                    'category_ids',
                    'fields',
                    'ship_to_country',
                    'country',
                    'target_currency',
                    'target_language',
                    'page_no',
                    'page_size',
                    'sort',
                    'tracking_id',
                ]),
                'provider_message' => $message,
                'reason' => 'affiliate_permission_missing',
                'remediation' => [
                    'Activer les permissions AE Affiliate sur l\'application AliExpress liee au compte fournisseur.',
                    'Reconnecter le compte fournisseur apres mise a jour des scopes OAuth.',
                    'Utiliser un autre compte AliExpress deja autorise pour les endpoints affiliate.',
                    'Les endpoints DS comme ds-product-get ne remplacent pas le bulk import affiliate, ils servent surtout aux recherches produit ciblees.',
                ],
            ],
            previous: $exception,
        );
    }

    private function throwAffiliateProviderResponseDiagnosticIfNeeded(string $operation, array $requestPayload, array $response): void
    {
        if (!str_starts_with($operation, 'ae-affiliate-')) {
            return;
        }

        $resp = $this->extractAffiliateProviderStatus($response);
        if (!is_array($resp) || $resp === []) {
            return;
        }

        $respCode = (string) ($resp['resp_code'] ?? '');
        $respMessage = trim((string) ($resp['resp_msg'] ?? ''));
        $hasOnlyStatus = array_diff(array_keys($resp), ['resp_code', 'resp_msg']) === [];

        if ($respMessage === '' && $respCode === '') {
            return;
        }

        if (!$hasOnlyStatus && $respCode !== '' && in_array(strtoupper($respCode), ['200', 'SUCCESS'], true)) {
            return;
        }

        throw new BulkImportDiagnosticException(
            'AliExpress a rejete la requete affiliate avant de retourner des produits.',
            [
                'operation' => $operation,
                'request_payload' => $this->summarizeAffiliateRequestPayload($requestPayload),
                'provider_code' => $respCode !== '' ? $respCode : null,
                'provider_message' => $respMessage !== '' ? $respMessage : null,
                'provider_status' => $resp,
                'reason' => 'affiliate_provider_rejected_request',
                'remediation' => [
                    'Verifier les parametres obligatoires de l\'operation choisie, notamment category_id et fields pour ae-affiliate-hotproduct-download.',
                    'Si l\'operation est ae-affiliate-hotproduct-download, prefere un payload minimal avec category_id, fields, page_no, page_size, target_currency, target_language, tracking_id et country.',
                    'Si AliExpress continue a renvoyer resp_msg, utiliser ce message provider comme source d\'autorite pour corriger le payload.',
                ],
            ]
        );
    }

    private function extractAffiliateProviderStatus(array $response): ?array
    {
        $wrappedRaw = $this->extractAliExpressAffiliateEnvelope($response['raw'] ?? null);

        $candidates = [
            $response['result'] ?? null,
            data_get($response, 'raw.resp_result'),
            data_get($wrappedRaw, 'resp_result'),
        ];

        foreach ($candidates as $candidate) {
            if (!is_array($candidate) || $candidate === []) {
                continue;
            }

            if (array_intersect(['resp_code', 'resp_msg'], array_keys($candidate)) === []) {
                continue;
            }

            return [
                'resp_code' => isset($candidate['resp_code']) ? (string) $candidate['resp_code'] : null,
                'resp_msg' => isset($candidate['resp_msg']) ? trim((string) $candidate['resp_msg']) : null,
                'keys' => array_keys($candidate),
            ];
        }

        return null;
    }

    private function validateAffiliateRequestPayload(string $operation, array $requestPayload): void
    {
        $requiredKeys = match ($operation) {
            'ae-affiliate-hotproduct-download' => ['category_id', 'fields'],
            'ae-affiliate-product-query', 'ae-affiliate-hotproduct-query' => ['page_no', 'page_size'],
            default => [],
        };

        $missingKeys = array_values(array_filter($requiredKeys, static function (string $key) use ($requestPayload): bool {
            if (!array_key_exists($key, $requestPayload)) {
                return true;
            }

            $value = $requestPayload[$key];

            return $value === null || $value === '';
        }));

        if ($missingKeys === []) {
            return;
        }

        throw new BulkImportDiagnosticException(
            'Le payload du bulk import AliExpress est incomplet pour cette operation.',
            [
                'operation' => $operation,
                'request_payload' => $this->summarizeAffiliateRequestPayload($requestPayload),
                'missing_keys' => $missingKeys,
                'reason' => 'affiliate_request_payload_incomplete',
                'remediation' => [
                    'Completer les champs obligatoires avant relance.',
                    'Pour ae-affiliate-hotproduct-download, renseigner au minimum category_id et fields.',
                ],
            ]
        );
    }

    private function sanitizeAffiliateRequestPayload(string $operation, array $requestPayload): array
    {
        $allowedKeys = match ($operation) {
            'ae-affiliate-product-query' => [
                'keywords',
                'category_ids',
                'page_no',
                'page_size',
                'sort',
                'target_currency',
                'target_language',
                'tracking_id',
                'ship_to_country',
                'min_sale_price',
                'max_sale_price',
                'platform_product_type',
            ],
            'ae-affiliate-hotproduct-query' => [
                'keywords',
                'category_ids',
                'page_no',
                'page_size',
                'sort',
                'target_currency',
                'target_language',
                'tracking_id',
                'ship_to_country',
            ],
            'ae-affiliate-hotproduct-download' => [
                'category_id',
                'fields',
                'page_no',
                'page_size',
                'target_currency',
                'target_language',
                'tracking_id',
                'country',
            ],
            'ae-affiliate-product-smartmatch' => [
                'page_no',
                'page_size',
                'sort',
                'target_currency',
                'target_language',
                'tracking_id',
                'ship_to_country',
            ],
            default => array_keys($requestPayload),
        };

        $sanitized = Arr::only($requestPayload, $allowedKeys);

        foreach (['keywords', 'tracking_id', 'target_language'] as $key) {
            if (array_key_exists($key, $sanitized)) {
                $value = trim((string) $sanitized[$key]);
                $sanitized[$key] = $value === '' ? null : $value;
            }
        }

        if (array_key_exists('tracking_id', $sanitized)) {
            $trackingId = Str::lower((string) $sanitized['tracking_id']);
            if (in_array($trackingId, ['primegaming', 'primegaming-bulk-import'], true)) {
                unset($sanitized['tracking_id']);
            }
        }

        foreach (['ship_to_country', 'country', 'target_currency'] as $key) {
            if (array_key_exists($key, $sanitized)) {
                $value = strtoupper(trim((string) $sanitized[$key]));
                $sanitized[$key] = $value === '' ? null : $value;
            }
        }

        foreach (['page_no', 'page_size'] as $key) {
            if (array_key_exists($key, $sanitized)) {
                $sanitized[$key] = max(1, (int) $sanitized[$key]);
            }
        }

        return array_filter($sanitized, static fn ($value) => $value !== null && $value !== '');
    }

    private function extractAffiliateProducts(mixed $result): array
    {
        $queue = [$this->normalizeAffiliateNode($result)];

        while ($queue !== []) {
            $node = $this->normalizeAffiliateNode(array_shift($queue));

            if (!is_array($node)) {
                continue;
            }

            if ($this->looksLikeAffiliateProductRow($node)) {
                return [$node];
            }

            if (array_is_list($node) && $node !== []) {
                $rows = array_values(array_filter(array_map(
                    fn ($item) => $this->normalizeAffiliateNode($item),
                    $node
                ), fn ($item) => $this->looksLikeAffiliateProductRow($item)));

                if ($rows !== []) {
                    return $rows;
                }
            }

            foreach ($node as $value) {
                $normalized = $this->normalizeAffiliateNode($value);
                if (is_array($normalized)) {
                    $queue[] = $normalized;
                }
            }
        }

        return [];
    }

    private function looksLikeAffiliateProductRow(mixed $value): bool
    {
        if (!is_array($value)) {
            return false;
        }

        $keys = array_keys($value);

        $identityKeys = [
            'product_id',
            'item_id',
            'productId',
            'itemId',
        ];
        $descriptorKeys = [
            'product_title',
            'productTitle',
            'title',
            'product_name',
            'promotion_link',
            'product_detail_url',
            'product_main_image_url',
            'app_sale_price',
            'sale_price',
            'target_sale_price',
        ];

        $hasIdentity = collect($identityKeys)->contains(fn ($key) => in_array($key, $keys, true));
        $hasDescriptor = collect($descriptorKeys)->contains(fn ($key) => in_array($key, $keys, true));

        return $hasIdentity && $hasDescriptor;
    }

    private function normalizeAffiliateNode(mixed $node): mixed
    {
        $current = $node;

        for ($i = 0; $i < 2; $i++) {
            if (!is_string($current)) {
                break;
            }

            $trimmed = trim($current);
            if ($trimmed === '' || (!str_starts_with($trimmed, '{') && !str_starts_with($trimmed, '['))) {
                break;
            }

            $decoded = json_decode($trimmed, true);
            if (!is_array($decoded)) {
                break;
            }

            $current = $decoded;
        }

        return $current;
    }

    private function summarizeAffiliateNode(mixed $node): array
    {
        $normalized = $this->normalizeAffiliateNode($node);

        if (!is_array($normalized)) {
            return [
                'type' => gettype($normalized),
                'preview' => is_scalar($normalized) ? Str::limit((string) $normalized, 160) : null,
            ];
        }

        if (array_is_list($normalized)) {
            $first = $normalized[0] ?? null;

            return [
                'type' => 'list',
                'count' => count($normalized),
                'first_item_keys' => is_array($first) ? array_slice(array_keys($first), 0, 20) : [],
            ];
        }

        $summary = [
            'type' => 'object',
            'keys' => array_slice(array_keys($normalized), 0, 25),
        ];

        if (array_key_exists('resp_code', $normalized) || array_key_exists('resp_msg', $normalized)) {
            $summary['resp_code'] = isset($normalized['resp_code']) ? (string) $normalized['resp_code'] : null;
            $summary['resp_msg'] = isset($normalized['resp_msg']) ? Str::limit(trim((string) $normalized['resp_msg']), 200) : null;
        }

        return $summary;
    }

    private function discoverAffiliateShapes(array $response): array
    {
        $shapes = [];
        $queue = [
            ['path' => 'result', 'node' => $response['result'] ?? null],
            ['path' => 'raw', 'node' => $response['raw'] ?? null],
        ];

        while ($queue !== [] && count($shapes) < 6) {
            $current = array_shift($queue);
            $path = (string) ($current['path'] ?? 'unknown');
            $node = $this->normalizeAffiliateNode($current['node'] ?? null);

            if (!is_array($node)) {
                continue;
            }

            if (array_is_list($node)) {
                $first = $node[0] ?? null;
                if (is_array($first)) {
                    $score = count(array_intersect(array_keys($first), [
                        'product_id',
                        'item_id',
                        'product_title',
                        'product_main_image_url',
                        'product_detail_url',
                        'target_sale_price',
                        'sale_price',
                    ]));

                    if ($score > 0) {
                        $shapes[] = [
                            'path' => $path,
                            'type' => 'list',
                            'count' => count($node),
                            'first_item_keys' => array_slice(array_keys($first), 0, 20),
                        ];
                    }
                }

                foreach (array_slice($node, 0, 3) as $index => $child) {
                    if (is_array($child)) {
                        $queue[] = ['path' => $path . '[' . $index . ']', 'node' => $child];
                    }
                }

                continue;
            }

            $interestingKeys = array_intersect(array_keys($node), [
                'products',
                'product_list',
                'items',
                'records',
                'list',
                'data',
                'result',
                'resp_result',
                'product_id',
                'item_id',
                'product_title',
            ]);

            if ($interestingKeys !== []) {
                $shapes[] = [
                    'path' => $path,
                    'type' => 'object',
                    'keys' => array_slice(array_keys($node), 0, 20),
                ];
            }

            foreach (array_slice($node, 0, 8, true) as $key => $child) {
                if (is_array($child) || is_string($child)) {
                    $queue[] = ['path' => $path . '.' . $key, 'node' => $child];
                }
            }
        }

        return $shapes;
    }

    private function normalizeAffiliateRow(SupplierAccount $account, array $row, array $options): ?array
    {
        $externalProductId = trim((string) ($row['product_id'] ?? $row['item_id'] ?? $row['productId'] ?? ''));
        $title = trim((string) ($row['product_title'] ?? $row['productTitle'] ?? $row['title'] ?? $row['product_name'] ?? ''));

        if ($externalProductId === '' || $title === '') {
            return null;
        }

        $sourceCurrency = strtoupper(trim((string) (
            $row['target_currency']
            ?? $row['currency']
            ?? Arr::get($row, 'sale_price.currency_code')
            ?? Arr::get($row, 'target_sale_price_currency')
            ?? $account->currency_code
            ?? 'USD'
        )));
        $sourceUnitPrice = $this->normalizeMoney(
            $row['target_sale_price']
            ?? $row['sale_price']
            ?? $row['app_sale_price']
            ?? $row['min_sale_price']
            ?? $row['original_price']
            ?? 0
        );
        $convertedPrice = $this->convertToFcfa($sourceUnitPrice, $sourceCurrency, (float) ($options['usd_to_xof_rate'] ?? 620));
        $originalConvertedPrice = $this->convertToFcfa(
            $this->normalizeMoney($row['target_original_price'] ?? $row['original_price'] ?? $row['app_original_price'] ?? $sourceUnitPrice),
            $sourceCurrency,
            (float) ($options['usd_to_xof_rate'] ?? 620)
        );
        $weightGrams = max(0, (int) ($row['product_weight'] ?? $row['weight'] ?? $options['default_weight_grams'] ?? 0));
        $cbm = $this->resolveEstimatedCbm($row, $options);
        $sourceUrl = trim((string) ($row['promotion_link'] ?? $row['product_detail_url'] ?? $row['detail_url'] ?? '')) ?: null;
        $mainImageUrl = trim((string) ($row['product_main_image_url'] ?? $row['product_main_image_url_https'] ?? $row['main_image_url'] ?? $row['image_url'] ?? '')) ?: null;
        $storeName = trim((string) ($row['shop_name'] ?? $row['seller_name'] ?? $row['store_name'] ?? $account->label)) ?: $account->label;

        return [
            'external_product_id' => $externalProductId,
            'external_offer_id' => trim((string) ($row['promotion_product_id'] ?? $row['offer_id'] ?? '')) ?: null,
            'title' => $title,
            'supplier_name' => $storeName,
            'source_url' => $sourceUrl,
            'main_image_url' => $mainImageUrl,
            'status' => 'affiliate_imported',
            'category_path_json' => array_values(array_filter([
                trim((string) ($row['first_level_category_name'] ?? '')),
                trim((string) ($row['second_level_category_name'] ?? '')),
            ])),
            'attributes_json' => [
                'shop_id' => $row['shop_id'] ?? null,
                'commission_rate' => $row['commission_rate'] ?? null,
                'orders_count' => $row['orders_count'] ?? $row['lastest_volume'] ?? null,
                'evaluate_rate' => $row['evaluate_rate'] ?? null,
                'source_currency' => $sourceCurrency,
                'source_unit_price' => $sourceUnitPrice,
                'converted_price_fcfa' => $convertedPrice,
                'target_original_price_fcfa' => $originalConvertedPrice,
            ],
            'product_payload_json' => [
                'affiliate_row' => $row,
            ],
            'replace_missing_skus' => true,
            'skus' => [[
                'external_sku_id' => $externalProductId . '-default',
                'sku_label' => 'Default',
                'variant_attributes_json' => [],
                'moq' => max(1, (int) ($options['target_moq'] ?? 1)),
                'unit_price' => $convertedPrice,
                'currency_code' => 'XOF',
                'shipping_template_json' => [],
                'weight_grams' => $weightGrams,
                'dimensions_json' => [],
                'available_quantity' => null,
                'lead_time_days' => max(1, (int) ($options['delivery_eta_days'] ?? 12)),
                'logistics_modes_json' => [
                    'grouped',
                    strtolower((string) ($options['source_logistics_profile'] ?? 'ordinary')),
                ],
                'sku_payload_json' => [
                    'source_currency' => $sourceCurrency,
                    'source_unit_price' => $sourceUnitPrice,
                    'converted_price_fcfa' => $convertedPrice,
                ],
                'is_active' => true,
            ]],
            '_storefront_defaults' => [
                'price_fcfa' => $convertedPrice,
                'old_price_fcfa' => $originalConvertedPrice,
                'estimated_weight_grams' => $weightGrams,
                'estimated_cbm' => $cbm,
                'source_logistics_profile' => strtolower((string) ($options['source_logistics_profile'] ?? 'ordinary')),
                'source_currency' => $sourceCurrency,
                'source_unit_price' => $sourceUnitPrice,
                'main_image_url' => $mainImageUrl,
                'source_url' => $sourceUrl,
            ],
        ];
    }

    private function syncLocalProduct(SupplierProduct $supplierProduct, array $supplierPayload, array $options, bool $publishProducts): array
    {
        $defaultSku = $supplierProduct->skus->sortBy('id')->first();
        if (!$defaultSku) {
            return ['created' => false, 'updated' => false];
        }

        $existingLink = ProductSupplierLink::query()
            ->with('product')
            ->where('supplier_product_sku_id', $defaultSku->id)
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->first();

        if ($existingLink?->product) {
            $product = $existingLink->product;
            $this->applyProductDefaults($product, $supplierPayload, $options, $publishProducts, false);
            return ['created' => false, 'updated' => true, 'product' => $product->fresh()];
        }

        $product = DB::transaction(function () use ($supplierProduct, $supplierPayload, $options, $publishProducts, $defaultSku) {
            $defaults = (array) ($supplierPayload['_storefront_defaults'] ?? []);
            $title = (string) $supplierProduct->title;

            $product = Product::create([
                'game_id' => null,
                'name' => Str::limit($title, 255, ''),
                'title' => Str::limit($title, 255, ''),
                'slug' => $this->generateUniqueProductSlug($title),
                'sku' => $this->generateUniqueProductSku($supplierProduct->external_product_id),
                'type' => 'item',
                'category' => 'accessory',
                'accessory_category' => 'gaming',
                'accessory_subcategory' => $this->inferAccessorySubcategory($title),
                'accessory_stock_mode' => 'air',
                'price' => $defaults['price_fcfa'] ?? 0,
                'shipping_fee' => 0,
                'old_price' => (($defaults['old_price_fcfa'] ?? 0) > ($defaults['price_fcfa'] ?? 0)) ? ($defaults['old_price_fcfa'] ?? null) : null,
                'stock' => 0,
                'price_fcfa' => (int) round((float) ($defaults['price_fcfa'] ?? 0)),
                'is_active' => $publishProducts,
                'shipping_required' => true,
                'delivery_type' => 'preorder',
                'delivery_eta_days' => max(1, (int) ($options['delivery_eta_days'] ?? 12)),
                'delivery_estimate_label' => 'Expedition groupee',
                'preferred_supplier_platform' => 'aliexpress',
                'supplier_shipping_mode' => 'grouped',
                'grouping_threshold' => max(1, (int) ($options['grouping_threshold'] ?? 3)),
                'grouping_current_count' => 0,
                'supplier_margin_type' => 'percent',
                'supplier_margin_value' => (float) ($options['margin_percent'] ?? 17),
                'supplier_shipping_fee' => 0,
                'estimated_weight_grams' => (int) ($defaults['estimated_weight_grams'] ?? 0),
                'estimated_cbm' => (float) ($defaults['estimated_cbm'] ?? 0),
                'source_logistics_profile' => $defaults['source_logistics_profile'] ?? 'ordinary',
                'country_availability_json' => ['CI', 'BJ', 'GH', 'TG'],
                'details' => array_filter([
                    'image' => $defaults['main_image_url'] ?? null,
                    'source_url' => $defaults['source_url'] ?? null,
                    'import_source' => 'aliexpress_affiliate',
                    'source_currency' => $defaults['source_currency'] ?? null,
                    'source_unit_price' => $defaults['source_unit_price'] ?? null,
                    'supplier_product_id' => $supplierProduct->id,
                    'supplier_external_product_id' => $supplierProduct->external_product_id,
                ], fn ($value) => $value !== null && $value !== ''),
                'description' => $this->buildDescription($supplierProduct, $defaults),
            ]);

            ProductSupplierLink::create([
                'product_id' => $product->id,
                'supplier_product_sku_id' => $defaultSku->id,
                'priority' => 1,
                'is_default' => true,
                'procurement_mode' => 'auto_batch',
                'target_moq' => max(1, (int) ($options['target_moq'] ?? 1)),
                'reorder_point' => 0,
                'reorder_quantity' => max(1, (int) ($options['reorder_quantity'] ?? 1)),
                'safety_stock' => 0,
                'warehouse_destination_label' => 'Hub France-Lome ' . strtoupper((string) ($options['default_country_code'] ?? 'TG')),
                'expected_inbound_days' => max(1, (int) ($options['delivery_eta_days'] ?? 12)),
                'pricing_snapshot_json' => [
                    'import_source' => 'aliexpress_affiliate',
                    'source_currency' => $defaults['source_currency'] ?? null,
                    'source_unit_price' => $defaults['source_unit_price'] ?? null,
                    'imported_price_fcfa' => $defaults['price_fcfa'] ?? 0,
                ],
            ]);

            return $product;
        });

        return ['created' => true, 'updated' => false, 'product' => $product->fresh()];
    }

    private function ensureStorefrontDefaults(SupplierProduct $supplierProduct, array $supplierPayload, array $options): array
    {
        $defaults = (array) ($supplierPayload['_storefront_defaults'] ?? []);
        if (($defaults['price_fcfa'] ?? null) !== null) {
            return $supplierPayload;
        }

        $defaultSku = $supplierProduct->relationLoaded('skus')
            ? $supplierProduct->skus->sortBy('id')->first()
            : $supplierProduct->skus()->orderBy('id')->first();
        $skuPayload = is_array($defaultSku?->sku_payload_json) ? $defaultSku->sku_payload_json : [];
        $sourceCurrency = strtoupper(trim((string) ($defaults['source_currency'] ?? $defaultSku?->currency_code ?? 'USD'))) ?: 'USD';
        $sourceUnitPrice = $defaults['source_unit_price'] ?? $defaultSku?->unit_price ?? null;
        $sourceOriginalPrice = $defaults['source_original_price'] ?? ($skuPayload['original_price'] ?? null);

        $defaults['source_currency'] = $sourceCurrency;
        $defaults['source_unit_price'] = $this->normalizeMoney($sourceUnitPrice);
        $defaults['source_original_price'] = $this->normalizeMoney($sourceOriginalPrice);
        $defaults['price_fcfa'] = $this->convertToFcfa($defaults['source_unit_price'] ?? 0, $sourceCurrency, (float) ($options['usd_to_xof_rate'] ?? 620));
        $defaults['old_price_fcfa'] = $this->convertToFcfa($defaults['source_original_price'] ?? ($defaults['source_unit_price'] ?? 0), $sourceCurrency, (float) ($options['usd_to_xof_rate'] ?? 620));
        $defaults['main_image_url'] = $defaults['main_image_url'] ?? $supplierProduct->main_image_url;
        $defaults['source_url'] = $defaults['source_url'] ?? $supplierProduct->source_url;
        $defaults['estimated_weight_grams'] = (int) ($defaults['estimated_weight_grams'] ?? $defaultSku?->weight_grams ?? $options['default_weight_grams'] ?? 0);
        $defaults['estimated_cbm'] = (float) ($defaults['estimated_cbm'] ?? $options['default_estimated_cbm'] ?? 0);
        $defaults['source_logistics_profile'] = $defaults['source_logistics_profile'] ?? strtolower((string) ($options['source_logistics_profile'] ?? 'ordinary'));

        $supplierPayload['_storefront_defaults'] = $defaults;

        return $supplierPayload;
    }

    private function applyProductDefaults(Product $product, array $supplierPayload, array $options, bool $publishProducts, bool $onlyFillMissing): void
    {
        $defaults = (array) ($supplierPayload['_storefront_defaults'] ?? []);

        $updates = [
            'price' => $defaults['price_fcfa'] ?? $product->price,
            'price_fcfa' => (int) round((float) ($defaults['price_fcfa'] ?? $product->price_fcfa ?? 0)),
            'old_price' => (($defaults['old_price_fcfa'] ?? 0) > ($defaults['price_fcfa'] ?? 0)) ? ($defaults['old_price_fcfa'] ?? null) : $product->old_price,
            'estimated_weight_grams' => (int) ($defaults['estimated_weight_grams'] ?? $product->estimated_weight_grams ?? 0),
            'estimated_cbm' => (float) ($defaults['estimated_cbm'] ?? $product->estimated_cbm ?? 0),
            'source_logistics_profile' => $defaults['source_logistics_profile'] ?? $product->source_logistics_profile,
            'grouping_threshold' => max(1, (int) ($options['grouping_threshold'] ?? $product->grouping_threshold ?? 3)),
            'supplier_margin_value' => (float) ($options['margin_percent'] ?? $product->supplier_margin_value ?? 17),
        ];

        if (!$onlyFillMissing) {
            $updates['is_active'] = $publishProducts ? true : (bool) $product->is_active;
        }

        $details = is_array($product->details) ? $product->details : [];
        $details['image'] = $defaults['main_image_url'] ?? ($details['image'] ?? null);
        $details['source_url'] = $defaults['source_url'] ?? ($details['source_url'] ?? null);
        $details['source_currency'] = $defaults['source_currency'] ?? ($details['source_currency'] ?? null);
        $details['source_unit_price'] = $defaults['source_unit_price'] ?? ($details['source_unit_price'] ?? null);
        $details['import_source'] = 'aliexpress_affiliate';
        $updates['details'] = array_filter($details, fn ($value) => $value !== null && $value !== '');

        $product->update($updates);
    }

    private function summarizeProduct(Product $product): array
    {
        return [
            'id' => $product->id,
            'name' => $product->name,
            'title' => $product->title,
            'slug' => $product->slug,
            'price' => (float) $product->price,
            'price_fcfa' => $product->price_fcfa,
            'is_active' => (bool) $product->is_active,
            'grouping_threshold' => $product->grouping_threshold,
        ];
    }

    private function generateUniqueProductSlug(string $title): string
    {
        $base = Str::slug($title) ?: 'aliexpress-item';
        $slug = $base;
        $suffix = 2;

        while (Product::query()->where('slug', $slug)->exists()) {
            $slug = $base . '-' . $suffix;
            $suffix++;
        }

        return $slug;
    }

    private function generateUniqueProductSku(string $externalProductId): string
    {
        $base = strtoupper(Str::substr(preg_replace('/[^A-Za-z0-9]+/', '', $externalProductId), 0, 12) ?: 'AEXP');
        $sku = 'AEX-' . $base;
        $suffix = 2;

        while (Product::query()->where('sku', $sku)->exists()) {
            $sku = 'AEX-' . $base . '-' . $suffix;
            $suffix++;
        }

        return $sku;
    }

    private function inferAccessorySubcategory(string $title): string
    {
        $normalized = Str::lower($title);

        return match (true) {
            str_contains($normalized, 'headset'), str_contains($normalized, 'earbud'), str_contains($normalized, 'casque') => 'audio',
            str_contains($normalized, 'keyboard'), str_contains($normalized, 'clavier') => 'keyboard',
            str_contains($normalized, 'mouse'), str_contains($normalized, 'souris') => 'mouse',
            str_contains($normalized, 'controller'), str_contains($normalized, 'manette'), str_contains($normalized, 'gamepad') => 'controller',
            str_contains($normalized, 'chair'), str_contains($normalized, 'chaise') => 'chair',
            str_contains($normalized, 'microphone'), str_contains($normalized, 'mic') => 'microphone',
            str_contains($normalized, 'monitor'), str_contains($normalized, 'screen') => 'monitor',
            str_contains($normalized, 'cable'), str_contains($normalized, 'charger') => 'cable',
            str_contains($normalized, 'desk'), str_contains($normalized, 'stand') => 'desk',
            default => 'accessory',
        };
    }

    private function resolveEstimatedCbm(array $row, array $options): float
    {
        $explicit = (float) ($row['product_volume'] ?? $row['volume'] ?? $options['default_estimated_cbm'] ?? 0);
        if ($explicit > 0) {
            return round($explicit, 4);
        }

        $length = (float) ($row['package_length'] ?? 0);
        $width = (float) ($row['package_width'] ?? 0);
        $height = (float) ($row['package_height'] ?? 0);
        if ($length > 0 && $width > 0 && $height > 0) {
            return round(($length * $width * $height) / 1000000, 4);
        }

        return 0.0;
    }

    private function buildDescription(SupplierProduct $supplierProduct, array $defaults): string
    {
        $parts = [
            'Import automatique AliExpress.',
            $supplierProduct->source_url ? 'Source: ' . $supplierProduct->source_url : null,
            !empty($defaults['source_unit_price']) ? 'Prix source: ' . $defaults['source_unit_price'] . ' ' . ($defaults['source_currency'] ?? 'USD') : null,
        ];

        return implode("\n", array_values(array_filter($parts)));
    }

    private function normalizeMoney(mixed $value): float
    {
        if (is_numeric($value)) {
            return round((float) $value, 2);
        }

        $normalized = preg_replace('/[^0-9.,-]/', '', (string) $value);
        if ($normalized === null || $normalized === '') {
            return 0.0;
        }

        $normalized = str_replace(',', '.', $normalized);

        return is_numeric($normalized) ? round((float) $normalized, 2) : 0.0;
    }

    private function convertToFcfa(float $amount, string $currency, float $usdToXofRate): float
    {
        $normalizedCurrency = strtoupper(trim($currency));
        if ($amount <= 0) {
            return 0.0;
        }

        return match ($normalizedCurrency) {
            'XOF', 'FCFA' => round($amount, 2),
            'EUR' => round($amount * 655.957, 2),
            default => round($amount * max(1, $usdToXofRate), 2),
        };
    }
}