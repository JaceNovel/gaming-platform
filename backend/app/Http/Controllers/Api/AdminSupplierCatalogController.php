<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SupplierProduct;
use App\Models\SupplierAccount;
use App\Services\SupplierApiClient;
use App\Services\SupplierCatalogImportService;
use Illuminate\Http\Request;

class AdminSupplierCatalogController extends Controller
{
    public function index(Request $request)
    {
        $query = SupplierProduct::query()
            ->with(['supplierAccount:id,platform,label', 'skus'])
            ->withCount('skus')
            ->latest('id');

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

    public function import(Request $request, SupplierCatalogImportService $importService)
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
            'replace_missing_skus' => 'sometimes|boolean',
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

        return response()->json([
            'data' => $product,
        ], 201);
    }

    public function fetchRemote(Request $request, SupplierApiClient $supplierApiClient)
    {
        $data = $request->validate([
            'supplier_account_id' => 'required|exists:supplier_accounts,id',
            'external_product_id' => 'required|string|max:255',
        ]);

        $account = SupplierAccount::query()->findOrFail((int) $data['supplier_account_id']);
        $normalized = $supplierApiClient->fetchRemoteProduct($account, (string) $data['external_product_id']);

        return response()->json([
            'data' => $normalized,
        ]);
    }
}