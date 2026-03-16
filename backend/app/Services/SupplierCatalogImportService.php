<?php

namespace App\Services;

use App\Models\SupplierProduct;
use App\Models\SupplierProductSku;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SupplierCatalogImportService
{
    public function import(int $supplierAccountId, array $payload): SupplierProduct
    {
        return DB::transaction(function () use ($supplierAccountId, $payload) {
            $externalProductId = trim((string) ($payload['external_product_id'] ?? ''));
            $title = trim((string) ($payload['title'] ?? ''));

            $supplierProduct = SupplierProduct::updateOrCreate(
                [
                    'supplier_account_id' => $supplierAccountId,
                    'external_product_id' => $externalProductId,
                ],
                [
                    'external_offer_id' => $this->nullableString($payload['external_offer_id'] ?? null),
                    'title' => $title,
                    'slug' => Str::slug($title) ?: null,
                    'supplier_name' => $this->nullableString($payload['supplier_name'] ?? null),
                    'source_url' => $this->nullableString($payload['source_url'] ?? null),
                    'main_image_url' => $this->nullableString($payload['main_image_url'] ?? null),
                    'category_path_json' => Arr::wrap($payload['category_path_json'] ?? []),
                    'attributes_json' => is_array($payload['attributes_json'] ?? null) ? $payload['attributes_json'] : [],
                    'product_payload_json' => is_array($payload['product_payload_json'] ?? null) ? $payload['product_payload_json'] : [],
                    'status' => $this->nullableString($payload['status'] ?? null) ?: 'imported',
                    'last_synced_at' => now(),
                ]
            );

            $skuIds = [];
            foreach ((array) ($payload['skus'] ?? []) as $skuPayload) {
                $externalSkuId = trim((string) ($skuPayload['external_sku_id'] ?? ''));
                if ($externalSkuId === '') {
                    continue;
                }

                $sku = SupplierProductSku::updateOrCreate(
                    [
                        'supplier_product_id' => $supplierProduct->id,
                        'external_sku_id' => $externalSkuId,
                    ],
                    [
                        'sku_label' => $this->nullableString($skuPayload['sku_label'] ?? null),
                        'variant_attributes_json' => is_array($skuPayload['variant_attributes_json'] ?? null) ? $skuPayload['variant_attributes_json'] : [],
                        'moq' => max(1, (int) ($skuPayload['moq'] ?? 1)),
                        'unit_price' => $skuPayload['unit_price'] ?? null,
                        'currency_code' => $this->nullableString($skuPayload['currency_code'] ?? null),
                        'shipping_template_json' => is_array($skuPayload['shipping_template_json'] ?? null) ? $skuPayload['shipping_template_json'] : [],
                        'weight_grams' => $skuPayload['weight_grams'] ?? null,
                        'dimensions_json' => is_array($skuPayload['dimensions_json'] ?? null) ? $skuPayload['dimensions_json'] : [],
                        'available_quantity' => $skuPayload['available_quantity'] ?? null,
                        'lead_time_days' => $skuPayload['lead_time_days'] ?? null,
                        'logistics_modes_json' => is_array($skuPayload['logistics_modes_json'] ?? null) ? $skuPayload['logistics_modes_json'] : [],
                        'sku_payload_json' => is_array($skuPayload['sku_payload_json'] ?? null) ? $skuPayload['sku_payload_json'] : [],
                        'is_active' => array_key_exists('is_active', $skuPayload) ? (bool) $skuPayload['is_active'] : true,
                    ]
                );

                $skuIds[] = $sku->id;
            }

            if (($payload['replace_missing_skus'] ?? true) && !empty($skuIds)) {
                SupplierProductSku::query()
                    ->where('supplier_product_id', $supplierProduct->id)
                    ->whereNotIn('id', $skuIds)
                    ->update(['is_active' => false]);
            }

            return $supplierProduct->fresh(['supplierAccount', 'skus']);
        });
    }

    private function nullableString(mixed $value): ?string
    {
        $normalized = trim((string) ($value ?? ''));
        return $normalized === '' ? null : $normalized;
    }
}