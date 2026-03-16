<?php

namespace App\Services;

use App\Models\ProcurementBatch;
use App\Models\ProcurementBatchDemand;
use App\Models\ProcurementBatchItem;
use App\Models\ProcurementDemand;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProcurementBatchService
{
    public function createDraftFromDemandIds(array $demandIds, ?User $admin = null): ProcurementBatch
    {
        return DB::transaction(function () use ($demandIds, $admin) {
            $demands = ProcurementDemand::query()
                ->with(['productSupplierLink', 'supplierProductSku.supplierProduct.supplierAccount'])
                ->whereIn('id', $demandIds)
                ->where('status', 'pending')
                ->lockForUpdate()
                ->get();

            if ($demands->isEmpty()) {
                throw new \RuntimeException('Aucune demande éligible.');
            }

            $groupKey = null;
            foreach ($demands as $demand) {
                $accountId = (int) ($demand->supplierProductSku?->supplierProduct?->supplierAccount?->id ?? 0);
                $destination = (string) ($demand->productSupplierLink?->warehouse_destination_label ?? '');
                $currency = (string) ($demand->supplierProductSku?->currency_code ?? '');
                $currentKey = implode('|', [$accountId, $destination, $currency]);
                if ($groupKey === null) {
                    $groupKey = $currentKey;
                    continue;
                }
                if ($currentKey !== $groupKey) {
                    throw new \RuntimeException('Les demandes sélectionnées doivent partager le même fournisseur, la même destination et la même devise.');
                }
            }

            $first = $demands->first();
            $batch = ProcurementBatch::create([
                'supplier_account_id' => $first->supplierProductSku?->supplierProduct?->supplierAccount?->id,
                'batch_number' => 'PB-' . now()->format('Ymd-His') . '-' . Str::upper(Str::random(4)),
                'status' => 'draft',
                'currency_code' => $first->supplierProductSku?->currency_code,
                'warehouse_destination_label' => $first->productSupplierLink?->warehouse_destination_label,
                'grouping_key' => $groupKey,
                'created_by' => $admin?->id,
            ]);

            $grouped = $demands->groupBy(function (ProcurementDemand $demand) {
                return implode(':', [
                    (int) ($demand->supplier_product_sku_id ?? 0),
                    (int) ($demand->product_id ?? 0),
                    (int) ($demand->product_supplier_link_id ?? 0),
                ]);
            });

            foreach ($grouped as $rows) {
                /** @var ProcurementDemand $firstDemand */
                $firstDemand = $rows->first();
                $quantityOrdered = (int) $rows->sum('quantity_to_procure');

                $batchItem = ProcurementBatchItem::create([
                    'procurement_batch_id' => $batch->id,
                    'supplier_product_sku_id' => $firstDemand->supplier_product_sku_id,
                    'product_id' => $firstDemand->product_id,
                    'product_supplier_link_id' => $firstDemand->product_supplier_link_id,
                    'quantity_ordered' => $quantityOrdered,
                    'unit_price' => $firstDemand->supplierProductSku?->unit_price,
                    'currency_code' => $firstDemand->supplierProductSku?->currency_code,
                    'line_total' => $firstDemand->supplierProductSku?->unit_price
                        ? ((float) $firstDemand->supplierProductSku->unit_price * $quantityOrdered)
                        : null,
                    'source_snapshot_json' => [
                        'sku_label' => $firstDemand->supplierProductSku?->sku_label,
                        'external_sku_id' => $firstDemand->supplierProductSku?->external_sku_id,
                        'external_product_id' => $firstDemand->supplierProductSku?->supplierProduct?->external_product_id,
                    ],
                ]);

                foreach ($rows as $demand) {
                    ProcurementBatchDemand::create([
                        'procurement_batch_item_id' => $batchItem->id,
                        'procurement_demand_id' => $demand->id,
                        'quantity_covered' => (int) $demand->quantity_to_procure,
                    ]);

                    $demand->update([
                        'status' => 'batched',
                        'batch_locked_at' => now(),
                    ]);
                }
            }

            return $batch->fresh(['supplierAccount', 'items.supplierProductSku.supplierProduct', 'items.product']);
        });
    }
}