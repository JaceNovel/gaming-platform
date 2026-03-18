<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductSupplierLink;
use App\Models\SupplierAccount;
use App\Models\SupplierProductSku;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminProductSourcingController extends Controller
{
    public function localProducts(Request $request)
    {
        $platform = (string) $request->query('platform', 'aliexpress');
        $importSource = $request->query('import_source');

        $query = Product::query()
            ->select(['id', 'name', 'title', 'stock', 'is_active', 'preferred_supplier_platform', 'details'])
            ->withCount('productSupplierLinks')
            ->latest('id');

        if ($platform === 'aliexpress') {
            $query->where('preferred_supplier_platform', 'aliexpress');
        }

        if (filled($importSource)) {
            $query->where('details->import_source', $importSource);
        }

        if ($request->boolean('without_mappings')) {
            $query->doesntHave('productSupplierLinks');
        }

        return response()->json([
            'data' => $query->limit(300)->get()->map(function (Product $product) {
                $details = is_array($product->details) ? $product->details : [];

                return [
                    'id' => $product->id,
                    'title' => $product->title ?: $product->name,
                    'stock' => $product->stock,
                    'is_active' => (bool) $product->is_active,
                    'import_source' => $details['import_source'] ?? null,
                    'supplier_external_product_id' => $details['supplier_external_product_id'] ?? null,
                    'supplier_product_id' => $details['supplier_product_id'] ?? null,
                    'source_url' => $details['source_url'] ?? null,
                    'mappings_count' => (int) $product->product_supplier_links_count,
                ];
            }),
        ]);
    }

    public function supplierAccounts(Request $request)
    {
        $query = SupplierAccount::query()->latest('id');

        if ($request->filled('platform')) {
            $query->where('platform', $request->query('platform'));
        }

        if ($request->boolean('active')) {
            $query->where('is_active', true);
        }

        return response()->json([
            'data' => $query->get(['id', 'label', 'platform', 'is_active', 'currency_code', 'last_sync_at']),
        ]);
    }

    public function mappings(Request $request)
    {
        $query = ProductSupplierLink::query()
            ->with([
                'product:id,name,title,stock',
                'supplierProductSku.supplierProduct.supplierAccount:id,platform,label',
                'supplierProductSku.supplierProduct:id,supplier_account_id,title,external_product_id',
            ])
            ->latest('id');

        if ($request->filled('platform')) {
            $query->whereHas('supplierProductSku.supplierProduct.supplierAccount', function ($builder) use ($request) {
                $builder->where('platform', $request->query('platform'));
            });
        }

        if ($request->filled('product_id')) {
            $query->where('product_id', $request->query('product_id'));
        }

        return response()->json([
            'data' => $query->get(),
        ]);
    }

    public function supplierSkus(Request $request)
    {
        $query = SupplierProductSku::query()
            ->with([
                'supplierProduct.supplierAccount:id,platform,label',
                'supplierProduct:id,supplier_account_id,title,external_product_id,main_image_url',
            ])
            ->where('is_active', true)
            ->latest('id');

        if ($request->filled('platform')) {
            $query->whereHas('supplierProduct.supplierAccount', function ($builder) use ($request) {
                $builder->where('platform', $request->query('platform'));
            });
        }

        if ($request->filled('supplier_account_id')) {
            $query->whereHas('supplierProduct', function ($builder) use ($request) {
                $builder->where('supplier_account_id', $request->query('supplier_account_id'));
            });
        }

        if ($request->filled('q')) {
            $search = trim((string) $request->query('q'));
            $query->where(function ($builder) use ($search) {
                $builder->where('sku_label', 'like', "%{$search}%")
                    ->orWhere('external_sku_id', 'like', "%{$search}%")
                    ->orWhereHas('supplierProduct', function ($inner) use ($search) {
                        $inner->where('title', 'like', "%{$search}%")
                            ->orWhere('external_product_id', 'like', "%{$search}%");
                    });
            });
        }

        return response()->json([
            'data' => $query->limit(200)->get(),
        ]);
    }

    public function storeMapping(Request $request)
    {
        $data = $request->validate([
            'product_id' => 'required|exists:products,id',
            'supplier_product_sku_id' => 'required|exists:supplier_product_skus,id',
            'priority' => 'nullable|integer|min:1|max:1000',
            'is_default' => 'sometimes|boolean',
            'procurement_mode' => 'nullable|string|in:manual_batch,auto_batch',
            'target_moq' => 'nullable|integer|min:1',
            'reorder_point' => 'nullable|integer|min:0',
            'reorder_quantity' => 'nullable|integer|min:1',
            'safety_stock' => 'nullable|integer|min:0',
            'warehouse_destination_label' => 'nullable|string|max:255',
            'expected_inbound_days' => 'nullable|integer|min:0',
        ]);

        $mapping = DB::transaction(function () use ($data) {
            $isDefault = (bool) ($data['is_default'] ?? false);

            if ($isDefault) {
                ProductSupplierLink::query()
                    ->where('product_id', $data['product_id'])
                    ->update(['is_default' => false]);
            }

            return ProductSupplierLink::updateOrCreate(
                [
                    'product_id' => $data['product_id'],
                    'supplier_product_sku_id' => $data['supplier_product_sku_id'],
                ],
                [
                    'priority' => $data['priority'] ?? 1,
                    'is_default' => $isDefault,
                    'procurement_mode' => $data['procurement_mode'] ?? 'manual_batch',
                    'target_moq' => $data['target_moq'] ?? null,
                    'reorder_point' => $data['reorder_point'] ?? null,
                    'reorder_quantity' => $data['reorder_quantity'] ?? null,
                    'safety_stock' => $data['safety_stock'] ?? null,
                    'warehouse_destination_label' => $data['warehouse_destination_label'] ?? null,
                    'expected_inbound_days' => $data['expected_inbound_days'] ?? null,
                ]
            );
        });

        return response()->json([
            'data' => $mapping->load([
                'product:id,name,title,stock',
                'supplierProductSku.supplierProduct.supplierAccount:id,platform,label',
                'supplierProductSku.supplierProduct:id,supplier_account_id,title,external_product_id',
            ]),
        ], 201);
    }
}