<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SupplierCountry;
use Illuminate\Http\Request;

class AdminSupplierCountryController extends Controller
{
    public function index(Request $request)
    {
        $query = SupplierCountry::query()->orderBy('sort_order')->orderBy('name');

        if ($request->filled('platform')) {
            $query->where('platform', $request->query('platform'));
        }

        if ($request->filled('active')) {
            $query->where('is_active', $request->boolean('active'));
        }

        return response()->json([
            'data' => $query->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'platform' => 'required|string|in:alibaba,aliexpress',
            'code' => 'required|string|max:2',
            'name' => 'required|string|max:120',
            'is_active' => 'sometimes|boolean',
            'storefront_enabled' => 'sometimes|boolean',
            'transit_provider_name' => 'nullable|string|max:160',
            'transit_city' => 'nullable|string|max:120',
            'currency_code' => 'nullable|string|max:8',
            'pricing_rules_json' => 'nullable|array',
            'customer_notice' => 'nullable|string',
            'sort_order' => 'nullable|integer|min:0|max:1000',
        ]);

        $country = SupplierCountry::create([
            'platform' => $data['platform'],
            'code' => strtoupper(trim((string) $data['code'])),
            'name' => trim((string) $data['name']),
            'is_active' => (bool) ($data['is_active'] ?? true),
            'storefront_enabled' => (bool) ($data['storefront_enabled'] ?? false),
            'transit_provider_name' => trim((string) ($data['transit_provider_name'] ?? '')) ?: null,
            'transit_city' => trim((string) ($data['transit_city'] ?? '')) ?: null,
            'currency_code' => strtoupper(trim((string) ($data['currency_code'] ?? 'XOF'))),
            'pricing_rules_json' => $data['pricing_rules_json'] ?? null,
            'customer_notice' => trim((string) ($data['customer_notice'] ?? '')) ?: null,
            'sort_order' => (int) ($data['sort_order'] ?? 0),
        ]);

        return response()->json(['data' => $country], 201);
    }

    public function update(Request $request, SupplierCountry $supplierCountry)
    {
        $data = $request->validate([
            'code' => 'sometimes|string|max:2',
            'name' => 'sometimes|string|max:120',
            'is_active' => 'sometimes|boolean',
            'storefront_enabled' => 'sometimes|boolean',
            'transit_provider_name' => 'nullable|string|max:160',
            'transit_city' => 'nullable|string|max:120',
            'currency_code' => 'nullable|string|max:8',
            'pricing_rules_json' => 'nullable|array',
            'customer_notice' => 'nullable|string',
            'sort_order' => 'nullable|integer|min:0|max:1000',
        ]);

        if (array_key_exists('code', $data)) {
            $data['code'] = strtoupper(trim((string) $data['code']));
        }

        if (array_key_exists('name', $data)) {
            $data['name'] = trim((string) $data['name']);
        }
        if (array_key_exists('transit_provider_name', $data)) {
            $data['transit_provider_name'] = trim((string) $data['transit_provider_name']) ?: null;
        }
        if (array_key_exists('transit_city', $data)) {
            $data['transit_city'] = trim((string) $data['transit_city']) ?: null;
        }
        if (array_key_exists('currency_code', $data)) {
            $data['currency_code'] = strtoupper(trim((string) $data['currency_code'] ?: 'XOF'));
        }
        if (array_key_exists('customer_notice', $data)) {
            $data['customer_notice'] = trim((string) $data['customer_notice']) ?: null;
        }

        $supplierCountry->update($data);

        return response()->json(['data' => $supplierCountry->fresh()]);
    }

    public function destroy(SupplierCountry $supplierCountry)
    {
        $supplierCountry->delete();

        return response()->json(['message' => 'Pays supprimé.']);
    }
}