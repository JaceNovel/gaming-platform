<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\BulkImportDiagnosticException;
use App\Http\Controllers\Controller;
use App\Models\SupplierProduct;
use App\Models\SupplierAccount;
use App\Services\AliExpressBulkCatalogImportService;
use App\Services\SupplierApiClient;
use App\Services\SupplierCatalogImportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class AdminSupplierCatalogController extends Controller
{
    public function index(Request $request)
    {
        $query = SupplierProduct::query()
            ->with(['supplierAccount:id,platform,label', 'skus'])
            ->withCount('skus')
            ->latest('id');

        if ($request->filled('platform')) {
            $query->whereHas('supplierAccount', function ($builder) use ($request) {
                $builder->where('platform', $request->query('platform'));
            });
        }

        if ($request->filled('supplier_account_id')) {
            $query->where('supplier_account_id', $request->query('supplier_account_id'));
        }

        if ($request->filled('q')) {
            $search = trim((string) $request->query('q'));
            $query->where(function ($builder) use ($search) {
                $builder->where('title', 'like', "%{$search}%")
                    ->orWhere('external_product_id', 'like', "%{$search}%")
                    ->orWhere('supplier_name', 'like', "%{$search}%");
            });
        }

        return response()->json([
            'data' => $query->limit(200)->get(),
        ]);
    }

    public function import(Request $request, SupplierCatalogImportService $importService, AliExpressBulkCatalogImportService $aliExpressBulkCatalogImportService)
    {
        $data = $request->validate([
            'supplier_account_id' => 'required|exists:supplier_accounts,id',
            'external_product_id' => 'required|string|max:255',
            'external_offer_id' => 'nullable|string|max:255',
            'title' => 'required|string|max:255',
            'supplier_name' => 'nullable|string|max:255',
            'source_url' => 'nullable|url|max:2048',
            'main_image_url' => 'nullable|url|max:2048',
            'status' => 'nullable|string|max:24',
            'category_path_json' => 'nullable|array',
            'attributes_json' => 'nullable|array',
            'product_payload_json' => 'nullable|array',
            '_storefront_defaults' => 'nullable|array',
            'replace_missing_skus' => 'sometimes|boolean',
            'auto_create_storefront_product' => 'sometimes|boolean',
            'publish_storefront_product' => 'sometimes|boolean',
            'manual_storefront_pricing' => 'sometimes|boolean',
            'storefront_variant_prices' => 'nullable|array|min:1',
            'storefront_variant_prices.*.external_sku_id' => 'required|string|max:255',
            'storefront_variant_prices.*.sku_label' => 'nullable|string|max:255',
            'storefront_variant_prices.*.variant_attributes_json' => 'nullable|array',
            'storefront_variant_prices.*.image_url' => 'nullable|url|max:2048',
            'storefront_variant_prices.*.sale_price_fcfa' => 'required|integer|min:0',
            'storefront_variant_prices.*.compare_at_price_fcfa' => 'nullable|integer|min:0',
            'usd_to_xof_rate' => 'nullable|numeric|min:1',
            'grouping_threshold' => 'nullable|integer|min:1|max:500',
            'margin_percent' => 'nullable|numeric|min:0|max:1000',
            'target_moq' => 'nullable|integer|min:1|max:1000',
            'reorder_quantity' => 'nullable|integer|min:1|max:1000',
            'delivery_eta_days' => 'nullable|integer|min:1|max:90',
            'default_country_code' => 'nullable|string|size:2',
            'source_logistics_profile' => 'nullable|string|in:ordinary,battery',
            'default_weight_grams' => 'nullable|integer|min:0|max:200000',
            'default_estimated_cbm' => 'nullable|numeric|min:0|max:10',
            'skus' => 'required|array|min:1',
            'skus.*.external_sku_id' => 'required|string|max:255',
            'skus.*.sku_label' => 'nullable|string|max:255',
            'skus.*.variant_attributes_json' => 'nullable|array',
            'skus.*.moq' => 'nullable|integer|min:1',
            'skus.*.unit_price' => 'nullable|numeric|min:0',
            'skus.*.currency_code' => 'nullable|string|max:8',
            'skus.*.shipping_template_json' => 'nullable|array',
            'skus.*.weight_grams' => 'nullable|integer|min:0',
            'skus.*.dimensions_json' => 'nullable|array',
            'skus.*.available_quantity' => 'nullable|integer|min:0',
            'skus.*.lead_time_days' => 'nullable|integer|min:0',
            'skus.*.logistics_modes_json' => 'nullable|array',
            'skus.*.sku_payload_json' => 'nullable|array',
            'skus.*.is_active' => 'sometimes|boolean',
        ]);

        $product = $importService->import((int) $data['supplier_account_id'], $data);
        $storefront = null;

        if (($data['auto_create_storefront_product'] ?? false) === true) {
            $account = SupplierAccount::query()->findOrFail((int) $data['supplier_account_id']);
            if ((string) $account->platform === 'aliexpress') {
                $storefront = $aliExpressBulkCatalogImportService->syncStorefrontProductFromSupplierImport($product, $data, [
                    'publish_products' => (bool) ($data['publish_storefront_product'] ?? false),
                    'manual_storefront_pricing' => (bool) ($data['manual_storefront_pricing'] ?? false),
                    'storefront_variant_prices' => $data['storefront_variant_prices'] ?? [],
                    'usd_to_xof_rate' => $data['usd_to_xof_rate'] ?? 620,
                    'grouping_threshold' => $data['grouping_threshold'] ?? 3,
                    'margin_percent' => $data['margin_percent'] ?? 17,
                    'target_moq' => $data['target_moq'] ?? 1,
                    'reorder_quantity' => $data['reorder_quantity'] ?? 1,
                    'delivery_eta_days' => $data['delivery_eta_days'] ?? 12,
                    'default_country_code' => strtoupper((string) ($data['default_country_code'] ?? 'TG')),
                    'source_logistics_profile' => $data['source_logistics_profile'] ?? 'ordinary',
                    'default_weight_grams' => $data['default_weight_grams'] ?? 0,
                    'default_estimated_cbm' => $data['default_estimated_cbm'] ?? 0,
                ]);
            }
        }

        return response()->json([
            'data' => $product,
            'storefront' => $storefront,
        ], 201);
    }

    public function bulkImportAliExpress(Request $request, AliExpressBulkCatalogImportService $bulkImportService)
    {
        $data = $request->validate([
            'supplier_account_id' => 'required|exists:supplier_accounts,id',
            'operation' => 'nullable|string|in:ae-affiliate-product-query,ae-affiliate-hotproduct-query,ae-affiliate-hotproduct-download,ae-affiliate-product-smartmatch',
            'limit' => 'nullable|integer|min:1|max:200',
            'request_payload' => 'required|array',
            'auto_create_products' => 'sometimes|boolean',
            'publish_products' => 'sometimes|boolean',
            'usd_to_xof_rate' => 'nullable|numeric|min:1',
            'grouping_threshold' => 'nullable|integer|min:1|max:500',
            'margin_percent' => 'nullable|numeric|min:0|max:1000',
            'target_moq' => 'nullable|integer|min:1|max:1000',
            'reorder_quantity' => 'nullable|integer|min:1|max:1000',
            'delivery_eta_days' => 'nullable|integer|min:1|max:90',
            'default_country_code' => 'nullable|string|size:2',
            'source_logistics_profile' => 'nullable|string|in:ordinary,battery',
            'default_weight_grams' => 'nullable|integer|min:0|max:200000',
            'default_estimated_cbm' => 'nullable|numeric|min:0|max:10',
        ]);

        try {
            $account = SupplierAccount::query()->findOrFail((int) $data['supplier_account_id']);
            $result = $bulkImportService->import($account, $data);
        } catch (Throwable $exception) {
            $diagnostic = $exception instanceof BulkImportDiagnosticException
                ? $exception->diagnostic()
                : null;

            Log::warning('sourcing.bulk_import_aliexpress_failed', [
                'supplier_account_id' => (int) $data['supplier_account_id'],
                'operation' => $data['operation'] ?? 'ae-affiliate-hotproduct-download',
                'message' => $exception->getMessage(),
                'diagnostic' => $diagnostic,
            ]);

            return response()->json([
                'message' => $exception->getMessage(),
                'diagnostic' => $diagnostic,
            ], 502);
        }

        return response()->json([
            'data' => $result,
        ], 201);
    }

    public function bulkImportAliExpressDs(Request $request, AliExpressBulkCatalogImportService $bulkImportService)
    {
        $data = $request->validate([
            'supplier_account_id' => 'required|exists:supplier_accounts,id',
            'operation' => 'nullable|string|in:ds-text-search,ds-feed-itemids-get',
            'limit' => 'nullable|integer|min:1|max:200',
            'request_payload' => 'required|array',
            'remote_mode' => 'nullable|string|in:ds_product,ds_wholesale',
            'ship_to_country' => 'nullable|string|size:2',
            'target_currency' => 'nullable|string|max:8',
            'target_language' => 'nullable|string|max:16',
            'remove_personal_benefit' => 'sometimes|boolean',
            'auto_create_products' => 'sometimes|boolean',
            'publish_products' => 'sometimes|boolean',
            'usd_to_xof_rate' => 'nullable|numeric|min:1',
            'grouping_threshold' => 'nullable|integer|min:1|max:500',
            'margin_percent' => 'nullable|numeric|min:0|max:1000',
            'target_moq' => 'nullable|integer|min:1|max:1000',
            'reorder_quantity' => 'nullable|integer|min:1|max:1000',
            'delivery_eta_days' => 'nullable|integer|min:1|max:90',
            'default_country_code' => 'nullable|string|size:2',
            'source_logistics_profile' => 'nullable|string|in:ordinary,battery',
            'default_weight_grams' => 'nullable|integer|min:0|max:200000',
            'default_estimated_cbm' => 'nullable|numeric|min:0|max:10',
        ]);

        try {
            $account = SupplierAccount::query()->findOrFail((int) $data['supplier_account_id']);
            $result = $bulkImportService->importDropshippingCatalog($account, $data + [
                'import_source' => 'aliexpress_ds',
            ]);
        } catch (Throwable $exception) {
            Log::warning('sourcing.bulk_import_aliexpress_ds_failed', [
                'supplier_account_id' => (int) $data['supplier_account_id'],
                'operation' => $data['operation'] ?? 'ds-text-search',
                'message' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => $exception->getMessage(),
            ], 502);
        }

        return response()->json([
            'data' => $result,
        ], 201);
    }

    public function bulkDelete(Request $request)
    {
        $data = $request->validate([
            'supplier_product_ids' => 'required|array|min:1|max:500',
            'supplier_product_ids.*' => 'integer|min:1',
        ]);

        $ids = array_values(array_unique(array_map('intval', $data['supplier_product_ids'])));
        $deleted = SupplierProduct::query()->whereIn('id', $ids)->delete();

        return response()->json([
            'message' => 'Produits fournisseur supprimes.',
            'data' => [
                'deleted' => $deleted,
            ],
        ]);
    }

    public function autoMapAliExpressDs(Request $request, AliExpressBulkCatalogImportService $bulkImportService)
    {
        $data = $request->validate([
            'supplier_account_id' => 'required|exists:supplier_accounts,id',
            'items' => 'required|array|min:1|max:200',
            'items.*.local_product_id' => 'required|integer|min:1',
            'items.*.external_product_id' => 'nullable|string|max:255',
            'items.*.title' => 'nullable|string|max:255',
            'ship_to_country' => 'nullable|string|size:2',
            'target_currency' => 'nullable|string|max:8',
            'target_language' => 'nullable|string|max:16',
            'priority' => 'nullable|integer|min:1|max:1000',
            'is_default' => 'sometimes|boolean',
            'procurement_mode' => 'nullable|string|in:manual_batch,auto_batch',
            'target_moq' => 'nullable|integer|min:1|max:1000',
            'reorder_quantity' => 'nullable|integer|min:1|max:1000',
            'expected_inbound_days' => 'nullable|integer|min:0|max:90',
            'warehouse_destination_label' => 'nullable|string|max:255',
        ]);

        try {
            $account = SupplierAccount::query()->findOrFail((int) $data['supplier_account_id']);
            $result = $bulkImportService->autoMapImportedProductsToDs($account, $data['items'], $data);
        } catch (Throwable $exception) {
            Log::warning('sourcing.auto_map_aliexpress_ds_failed', [
                'supplier_account_id' => (int) $data['supplier_account_id'],
                'items_count' => is_array($data['items'] ?? null) ? count($data['items']) : 0,
                'message' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => $exception->getMessage(),
            ], 502);
        }

        return response()->json([
            'data' => $result,
        ], 201);
    }

    public function fetchRemote(Request $request, SupplierApiClient $supplierApiClient)
    {
        $data = $request->validate([
            'supplier_account_id' => 'required|exists:supplier_accounts,id',
            'external_product_id' => 'required|string|max:255',
            'lookup_type' => 'nullable|in:product_id,sku_id',
            'remote_mode' => 'nullable|in:standard,ds_product,ds_wholesale',
            'ship_to_country' => 'nullable|string|size:2',
            'target_currency' => 'nullable|string|max:8',
            'target_language' => 'nullable|string|max:16',
            'remove_personal_benefit' => 'nullable|boolean',
            'biz_model' => 'nullable|string|max:64',
            'province_code' => 'nullable|string|max:64',
            'city_code' => 'nullable|string|max:64',
        ]);

        try {
            $account = SupplierAccount::query()->findOrFail((int) $data['supplier_account_id']);
            $normalized = $supplierApiClient->fetchRemoteProduct($account, (string) $data['external_product_id'], $data['lookup_type'] ?? null, [
                'remote_mode' => $data['remote_mode'] ?? 'standard',
                'ship_to_country' => strtoupper((string) ($data['ship_to_country'] ?? 'TG')),
                'target_currency' => $data['target_currency'] ?? null,
                'target_language' => $data['target_language'] ?? null,
                'remove_personal_benefit' => $data['remove_personal_benefit'] ?? null,
                'biz_model' => $data['biz_model'] ?? null,
                'province_code' => $data['province_code'] ?? null,
                'city_code' => $data['city_code'] ?? null,
            ]);
        } catch (Throwable $exception) {
            Log::warning('sourcing.fetch_remote_failed', [
                'supplier_account_id' => (int) $data['supplier_account_id'],
                'external_product_id' => (string) $data['external_product_id'],
                'lookup_type' => $data['lookup_type'] ?? null,
                'message' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => $exception->getMessage(),
            ], 502);
        }

        return response()->json([
            'data' => $normalized,
        ]);
    }

    public function searchRemote(Request $request, SupplierApiClient $supplierApiClient)
    {
        $data = $request->validate([
            'supplier_account_id' => 'required|exists:supplier_accounts,id',
            'model_number' => 'nullable|string|max:255',
            'sku_code' => 'nullable|string|max:255',
            'page_index' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:20',
        ]);

        if (!filled($data['model_number'] ?? null) && !filled($data['sku_code'] ?? null)) {
            return response()->json([
                'message' => 'Renseigne au moins model_number ou sku_code.',
            ], 422);
        }

        try {
            $account = SupplierAccount::query()->findOrFail((int) $data['supplier_account_id']);
            $results = $supplierApiClient->searchRemoteProducts($account, $data);
        } catch (Throwable $exception) {
            Log::warning('sourcing.search_remote_failed', [
                'supplier_account_id' => (int) $data['supplier_account_id'],
                'model_number' => $data['model_number'] ?? null,
                'sku_code' => $data['sku_code'] ?? null,
                'message' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => $exception->getMessage(),
            ], 502);
        }

        return response()->json([
            'data' => $results,
        ]);
    }

    public function predictCategory(Request $request, SupplierApiClient $supplierApiClient)
    {
        $data = $request->validate([
            'supplier_account_id' => 'required|exists:supplier_accounts,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:5000',
            'image' => 'nullable|url|max:2048',
        ]);

        try {
            $account = SupplierAccount::query()->findOrFail((int) $data['supplier_account_id']);
            $prediction = $supplierApiClient->predictCategory($account, $data);
        } catch (Throwable $exception) {
            Log::warning('sourcing.predict_category_failed', [
                'supplier_account_id' => (int) $data['supplier_account_id'],
                'title' => (string) $data['title'],
                'message' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => $exception->getMessage(),
            ], 502);
        }

        return response()->json([
            'data' => $prediction,
        ]);
    }

    public function uploadVideo(Request $request, SupplierApiClient $supplierApiClient)
    {
        $data = $request->validate([
            'supplier_account_id' => 'required|exists:supplier_accounts,id',
            'video_path' => 'required|url|max:2048',
            'video_name' => 'required|string|max:255',
            'video_cover' => 'nullable|url|max:2048',
        ]);

        $account = SupplierAccount::query()->findOrFail((int) $data['supplier_account_id']);
        $result = $supplierApiClient->uploadVideo($account, $data);

        return response()->json([
            'data' => $result,
        ]);
    }

    public function videoUploadResult(Request $request, SupplierApiClient $supplierApiClient)
    {
        $data = $request->validate([
            'supplier_account_id' => 'required|exists:supplier_accounts,id',
            'req_id' => 'required|string|max:255',
        ]);

        $account = SupplierAccount::query()->findOrFail((int) $data['supplier_account_id']);
        $result = $supplierApiClient->getVideoUploadResult($account, (string) $data['req_id']);

        return response()->json([
            'data' => $result,
        ]);
    }

    public function queryVideos(Request $request, SupplierApiClient $supplierApiClient)
    {
        $data = $request->validate([
            'supplier_account_id' => 'required|exists:supplier_accounts,id',
            'current_page' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:50',
            'video_id' => 'nullable|string|max:255',
        ]);

        $account = SupplierAccount::query()->findOrFail((int) $data['supplier_account_id']);
        $result = $supplierApiClient->queryVideos($account, $data);

        return response()->json([
            'data' => $result,
        ]);
    }

    public function attachMainVideo(Request $request, SupplierApiClient $supplierApiClient)
    {
        $data = $request->validate([
            'supplier_account_id' => 'required|exists:supplier_accounts,id',
            'video_id' => 'required|string|max:255',
            'product_id' => 'required|string|max:255',
        ]);

        $account = SupplierAccount::query()->findOrFail((int) $data['supplier_account_id']);
        $result = $supplierApiClient->attachVideoToProductMain($account, (string) $data['video_id'], (string) $data['product_id']);

        return response()->json([
            'data' => $result,
        ]);
    }

    public function buyerAddItem(Request $request, SupplierApiClient $supplierApiClient)
    {
        $data = $request->validate([
            'supplier_account_id' => 'required|exists:supplier_accounts,id',
            'insertReq' => 'required|array',
        ]);

        $account = SupplierAccount::query()->findOrFail((int) $data['supplier_account_id']);
        $result = $supplierApiClient->buyerAddItem($account, $data['insertReq']);

        return response()->json([
            'data' => $result,
        ]);
    }

    public function buyerUpdateItem(Request $request, SupplierApiClient $supplierApiClient)
    {
        $data = $request->validate([
            'supplier_account_id' => 'required|exists:supplier_accounts,id',
            'updateReq' => 'required|array',
        ]);

        $account = SupplierAccount::query()->findOrFail((int) $data['supplier_account_id']);
        $result = $supplierApiClient->buyerUpdateItem($account, $data['updateReq']);

        return response()->json([
            'data' => $result,
        ]);
    }

    public function buyerDeleteItem(Request $request, SupplierApiClient $supplierApiClient)
    {
        $data = $request->validate([
            'supplier_account_id' => 'required|exists:supplier_accounts,id',
            'deleteReq' => 'required|array',
        ]);

        $account = SupplierAccount::query()->findOrFail((int) $data['supplier_account_id']);
        $result = $supplierApiClient->buyerDeleteItem($account, $data['deleteReq']);

        return response()->json([
            'data' => $result,
        ]);
    }

    public function buyerQueryItems(Request $request, SupplierApiClient $supplierApiClient)
    {
        $data = $request->validate([
            'supplier_account_id' => 'required|exists:supplier_accounts,id',
            'queryReq' => 'required',
        ]);

        $queryReq = $data['queryReq'];
        if (is_string($queryReq)) {
            $decoded = json_decode($queryReq, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $queryReq = $decoded;
            }
        }

        $account = SupplierAccount::query()->findOrFail((int) $data['supplier_account_id']);
        $result = $supplierApiClient->buyerQueryItems($account, $queryReq);

        return response()->json([
            'data' => $result,
        ]);
    }

    public function buyerEcoOperation(Request $request, string $operation, SupplierApiClient $supplierApiClient)
    {
        $allowedOperations = [
            'product-events',
            'channel-batch-import',
            'crossborder-check',
            'product-cert',
            'product-description',
            'product-keyattributes',
            'product-inventory',
            'local-check',
            'localregular-check',
            'item-rec-image',
            'product-check',
            'product-search',
            'item-rec',
        ];

        if (!in_array($operation, $allowedOperations, true)) {
            return response()->json([
                'message' => 'Opération buyer eco non supportée.',
            ], 404);
        }

        $data = $request->validate([
            'supplier_account_id' => 'required|exists:supplier_accounts,id',
            'request_payload' => 'required',
        ]);

        $payload = $data['request_payload'];
        if (is_string($payload)) {
            $decoded = json_decode($payload, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $payload = $decoded;
            }
        }

        $account = SupplierAccount::query()->findOrFail((int) $data['supplier_account_id']);
        $result = $supplierApiClient->buyerEcoOperation($account, $operation, $payload);

        return response()->json([
            'data' => $result,
        ]);
    }

    public function iopOperation(Request $request, string $operation, SupplierApiClient $supplierApiClient)
    {
        $allowedOperations = [
            'advanced-freight-calculate',
            'basic-freight-calculate',
            'ds-order-create',
            'ds-product-get',
                        'ds-product-specialinfo-get',
            'ds-product-wholesale-get',
                        'ds-text-search',
                        'ds-search-event-report',
            'ds-image-search-v2',
            'ds-category-get',
            'ds-feed-itemids-get',
                        'ds-member-benefit-get',
                        'ds-freight-query',
            'buyer-freight-calculate',
            'ds-trade-order-get',
            'ds-order-tracking-get',
            'merge-pay-query',
            'buynow-order-create',
            'logistics-tracking-get',
            'overseas-admittance-check',
            'dropshipping-order-pay',
            'order-fund-query',
            'ggs-warehouse-list',
            'order-cancel',
            'order-get',
            'order-list',
            'order-pay-result-query',
            'seller-warehouse-list',
            'order-logistics-query',
            'ae-affiliate-product-shipping',
            'ae-affiliate-sku-detail',
            'ae-affiliate-product-detail',
            'ae-affiliate-product-query',
            'ae-affiliate-category-get',
            'ae-affiliate-link-generate',
            'ae-affiliate-order-get',
            'ae-affiliate-order-list',
            'ae-affiliate-order-listbyindex',
            'ae-affiliate-hotproduct-query',
            'ae-affiliate-hotproduct-download',
            'ae-affiliate-product-smartmatch',
            'ae-invoice-request-query',
            'ae-fund-merchant-orderdetail',
            'ae-brazil-invoice-query',
            'ae-brazil-invoice-upload',
            'ae-invoice-result-push',
            'ae-hscode-regulatory-attributes-query',
            'ae-hscode-regulatory-attributes-options',
            'ae-fund-recipet-flowdetail-query',
            'ae-fund-recipet-config-query',
            'ae-fund-recipet-debt-query',
            'ae-customize-product-info-query',
            'ae-customize-product-template-query',
            'ae-customize-product-info-audit-result-query',
            'ae-customize-product-info-create',
            'ae-local-cb-product-prices-edit',
            'ae-local-cb-product-status-update',
            'ae-local-cb-product-edit',
            'ae-local-cb-products-list',
            'ae-local-cb-product-post',
            'ae-local-cb-products-stock-edit',
            'ae-local-cb-product-query',
            'ae-category-child-attributes-query',
            'ae-category-tree-list',
            'ae-category-item-qualification-list',
            'ae-category-cascade-properties-query',
            'ae-solution-sku-attribute-query',
            'ae-seller-category-tree-query',
            'ae-category-qualifications-list',
            'ae-freight-seller-intention-query',
            'ae-freight-isv-gray-query',
            'ae-freight-template-recommend',
            'ae-freight-template-create',
            'ae-freight-template-list',
            'ae-trade-order-decrypt',
            'ae-solution-order-receiptinfo-get',
            'ae-solution-order-get',
            'ae-trade-verifycode',
            'ae-trade-confirmshippingmode',
            'ae-trade-sendcode',
            'ae-asf-local2local-sub-declareship',
            'ae-asf-dbs-declareship',
            'ae-asf-local2local-self-pickup-declareship',
            'ae-asf-dbs-declare-ship-modify',
            'ae-asf-shipment-pack',
            'ae-asf-order-shipping-service-get',
            'ae-asf-package-shipping-service-get',
            'ae-asf-local2local-split-quantity-rts-pack',
            'ae-asf-platform-logistics-document-query',
            'ae-asf-platform-logistics-rts',
            'ae-asf-platform-logistics-repack',
            'ae-asf-local-unreachable-preference-query',
            'ae-asf-seller-address-get',
            'ae-asf-local-unreachable-preference-update',
            'ae-asf-local2local-transfer-to-offline',
            'ae-asf-fulfillment-package-query',
            'ae-asf-local-supply-shipping-service-get',
            'ae-asf-local-supply-batch-declareship',
            'ae-asf-local-supply-declareship-modify',
            'ae-asf-local-supply-sub-declareship',
            'ae-asf-local-supply-split-quantity-rts-pack',
            'ae-asf-local-supply-platform-logistics-document-query',
            'ae-asf-local-supply-platform-logistics-rts',
            'ae-asf-local-supply-platform-logistics-repack',
            'ae-asf-local-supply-seller-address-get',
            'ae-local-service-product-stocks-update',
            'ae-local-service-product-stocks-query',
            'ae-local-service-products-list',
            'ae-local-service-product-prices-edit',
            'ae-local-service-product-post',
            'ae-local-service-product-edit',
            'ae-local-service-product-query',
            'ae-local-service-product-status-update',
        ];

        if (!in_array($operation, $allowedOperations, true)) {
            return response()->json([
                'message' => 'Opération IOP non supportée.',
            ], 404);
        }

        $data = $request->validate([
            'supplier_account_id' => 'required|exists:supplier_accounts,id',
            'request_payload' => 'nullable',
        ]);

        $payload = $data['request_payload'] ?? null;
        if (is_string($payload)) {
            $decoded = json_decode($payload, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $payload = $decoded;
            }
        }

        $account = SupplierAccount::query()->findOrFail((int) $data['supplier_account_id']);
        $result = $supplierApiClient->iopOperation($account, $operation, $payload);

        return response()->json([
            'data' => $result,
        ]);
    }

    public function uploadOrderAttachment(Request $request, SupplierApiClient $supplierApiClient)
    {
        $data = $request->validate([
            'supplier_account_id' => 'required|exists:supplier_accounts,id',
            'file_name' => 'required|string|max:255',
            'file_content_base64' => 'required|string',
        ]);

        $account = SupplierAccount::query()->findOrFail((int) $data['supplier_account_id']);
        $result = $supplierApiClient->uploadOrderAttachment($account, (string) $data['file_name'], (string) $data['file_content_base64']);

        return response()->json([
            'data' => $result,
        ]);
    }
}