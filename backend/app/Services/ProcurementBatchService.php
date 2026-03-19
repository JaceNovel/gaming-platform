<?php

namespace App\Services;

use App\Models\Order;
use App\Models\ProcurementBatch;
use App\Models\ProcurementBatchDemand;
use App\Models\ProcurementBatchItem;
use App\Models\ProcurementDemand;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProcurementBatchService
{
    private GroupedLotService $groupedLotService;

    public function __construct(?GroupedLotService $groupedLotService = null)
    {
        $this->groupedLotService = $groupedLotService ?? new GroupedLotService();
    }

    public function createDraftFromDemandIds(array $demandIds, ?User $admin = null, array $options = []): ProcurementBatch
    {
        return DB::transaction(function () use ($demandIds, $admin, $options) {
            $demands = ProcurementDemand::query()
                ->with([
                    'order:id,supplier_fulfillment_status,grouping_released_at',
                    'product:id,name,title,grouping_threshold',
                    'productSupplierLink',
                    'supplierProductSku.supplierProduct.supplierAccount',
                ])
                ->whereIn('id', $demandIds)
                ->where('status', 'pending')
                ->lockForUpdate()
                ->get();

            if ($demands->isEmpty()) {
                throw new \RuntimeException('Aucune demande éligible.');
            }

            $this->ensureGroupingThresholdReleased($demands);
            $this->ensureSupplierMoqReached($demands);

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
                'supplier_order_payload_json' => $this->buildBatchPayloadMeta($demands, $options),
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

    public function autoCreateReadyDraftBatches(array $productIds, string $countryCode): array
    {
        $normalizedProductIds = array_values(array_unique(array_filter(array_map('intval', $productIds), static fn (int $id) => $id > 0)));
        $countryCode = strtoupper(trim($countryCode));
        if ($normalizedProductIds === [] || $countryCode === '') {
            return [];
        }

        $demands = ProcurementDemand::query()
            ->with([
                'order:id,status,supplier_country_code,supplier_fulfillment_status,grouping_released_at',
                'product:id,name,title,grouping_threshold',
                'productSupplierLink',
                'supplierProductSku.supplierProduct.supplierAccount',
            ])
            ->whereIn('product_id', $normalizedProductIds)
            ->where('status', 'pending')
            ->whereNull('batch_locked_at')
            ->whereHas('order', function ($query) use ($countryCode) {
                $query->where('status', Order::STATUS_PAYMENT_SUCCESS)
                    ->where('supplier_country_code', $countryCode)
                    ->whereNotNull('grouping_released_at');
            })
            ->get();

        $groups = $this->buildAutoDraftDemandGroups($demands);
        $created = [];

        foreach ($groups as $group) {
            try {
                $created[] = $this->createDraftFromDemandIds($group['demand_ids'], null, [
                    'auto_generated_from_grouping' => true,
                    'auto_generated_country_code' => $countryCode,
                    'auto_generated_product_ids' => $group['product_ids'],
                ]);
            } catch (\Throwable $exception) {
                report($exception);
            }
        }

        return $created;
    }

    public function groupedReadySummary(string $platform = 'aliexpress'): array
    {
        $pendingDemands = ProcurementDemand::query()
            ->with([
                'order:id,reference,status,supplier_country_code,supplier_fulfillment_status,grouping_released_at',
                'orderItem:id,order_id,product_id,price',
                'product:id,name,title,grouping_threshold',
                'productSupplierLink',
                'supplierProductSku.supplierProduct.supplierAccount',
            ])
            ->where('status', 'pending')
            ->whereNull('batch_locked_at')
            ->whereHas('supplierProductSku.supplierProduct.supplierAccount', function ($builder) use ($platform) {
                $builder->where('platform', $platform);
            })
            ->whereHas('order', function ($query) {
                $query->where('status', Order::STATUS_PAYMENT_SUCCESS)
                    ->whereNotNull('grouping_released_at');
            })
            ->get();

        $readyGroups = collect($this->buildAutoDraftDemandGroups($pendingDemands))
            ->map(function (array $group) {
                /** @var ProcurementDemand|null $first */
                $first = $group['demands']->first();
                $required = $first && $first->product
                    ? $this->groupedLotService->resolveEffectiveGroupingQuantity($first->product, $first->productSupplierLink)
                    : GroupedLotService::MOQ_BATCH_MULTIPLIER;
                $quantity = (int) $group['demands']->sum('quantity_to_procure');
                $lotAmount = (float) $group['demands']->sum(function (ProcurementDemand $demand) {
                    return ((float) ($demand->orderItem?->price ?? 0)) * (int) ($demand->quantity_to_procure ?? 0);
                });

                return [
                    'product_ids' => $group['product_ids'],
                    'product_title' => $group['product_label'],
                    'supplier_account' => $first?->supplierProductSku?->supplierProduct?->supplierAccount?->label,
                    'sku_label' => $first?->supplierProductSku?->sku_label,
                    'country_code' => $first?->order?->supplier_country_code,
                    'warehouse_destination_label' => $first?->productSupplierLink?->warehouse_destination_label,
                    'quantity_to_procure' => $quantity,
                    'required_moq' => $required,
                    'grouping_threshold' => $required,
                    'lot_amount' => round($lotAmount, 2),
                    'minimum_lot_amount' => GroupedLotService::MINIMUM_LOT_AMOUNT_XOF,
                    'demand_ids' => $group['demand_ids'],
                    'order_references' => $group['demands']->map(fn (ProcurementDemand $demand) => $demand->order?->reference)->filter()->values()->all(),
                ];
            })
            ->values()
            ->all();

        $autoBatches = ProcurementBatch::query()
            ->with([
                'supplierAccount:id,platform,label',
                'items.product:id,name,title',
                'items.supplierProductSku:id,sku_label',
                'items.supplierProductSku.supplierProduct:id,title',
            ])
            ->whereHas('supplierAccount', function ($builder) use ($platform) {
                $builder->where('platform', $platform);
            })
            ->latest('id')
            ->limit(100)
            ->get()
            ->filter(function (ProcurementBatch $batch): bool {
                return (bool) data_get($batch->supplier_order_payload_json, 'auto_generated_from_grouping');
            })
            ->map(function (ProcurementBatch $batch) {
                return [
                    'id' => $batch->id,
                    'batch_number' => $batch->batch_number,
                    'status' => $batch->status,
                    'supplier_order_reference' => $batch->supplier_order_reference,
                    'supplier_account' => $batch->supplierAccount?->label,
                    'created_at' => $batch->created_at?->toIso8601String(),
                    'submitted_at' => $batch->submitted_at?->toIso8601String(),
                    'country_code' => data_get($batch->supplier_order_payload_json, 'auto_generated_country_code'),
                    'product_ids' => Arr::wrap(data_get($batch->supplier_order_payload_json, 'auto_generated_product_ids', [])),
                    'items' => $batch->items->map(function (ProcurementBatchItem $item) {
                        return [
                            'product_title' => $item->product?->title ?: $item->product?->name,
                            'sku_label' => $item->supplierProductSku?->sku_label,
                            'quantity_ordered' => (int) ($item->quantity_ordered ?? 0),
                        ];
                    })->values()->all(),
                ];
            })
            ->values()
            ->all();

        return [
            'ready_groups' => $readyGroups,
            'auto_batches' => $autoBatches,
        ];
    }

    private function buildAutoDraftDemandGroups(Collection $demands): array
    {
        $eligibleDemands = $demands
            ->filter(function (ProcurementDemand $demand): bool {
                return $demand->order?->grouping_released_at !== null;
            })
            ->groupBy(function (ProcurementDemand $demand) {
                return implode(':', [
                    (int) ($demand->supplier_product_sku_id ?? 0),
                    (int) ($demand->product_id ?? 0),
                    (int) ($demand->product_supplier_link_id ?? 0),
                ]);
            })
            ->filter(function (Collection $rows): bool {
                /** @var ProcurementDemand|null $first */
                $first = $rows->first();
                $required = $first && $first->product
                    ? $this->groupedLotService->resolveEffectiveGroupingQuantity($first->product, $first->productSupplierLink)
                    : GroupedLotService::MOQ_BATCH_MULTIPLIER;

                return (int) $rows->sum('quantity_to_procure') >= $required;
            })
            ->flatten(1)
            ->values();

        return $eligibleDemands
            ->groupBy(function (ProcurementDemand $demand) {
                $accountId = (int) ($demand->supplierProductSku?->supplierProduct?->supplierAccount?->id ?? 0);
                $destination = (string) ($demand->productSupplierLink?->warehouse_destination_label ?? '');
                $currency = (string) ($demand->supplierProductSku?->currency_code ?? '');

                return implode('|', [$accountId, $destination, $currency]);
            })
            ->map(function (Collection $rows) {
                $productLabels = $rows
                    ->map(fn (ProcurementDemand $demand) => $demand->product?->title ?: $demand->product?->name)
                    ->filter()
                    ->unique()
                    ->values();

                return [
                    'demands' => $rows->values(),
                    'demand_ids' => $rows->pluck('id')->map(fn ($id) => (int) $id)->values()->all(),
                    'product_ids' => $rows->pluck('product_id')->map(fn ($id) => (int) $id)->unique()->values()->all(),
                    'product_label' => $productLabels->implode(', '),
                ];
            })
            ->values()
            ->all();
    }

    private function buildBatchPayloadMeta(Collection $demands, array $options): ?array
    {
        $payload = [];

        if (! empty($options['auto_generated_from_grouping'])) {
            $payload['auto_generated_from_grouping'] = true;
            $payload['auto_generated_at'] = now()->toIso8601String();
            $payload['auto_generated_country_code'] = $options['auto_generated_country_code'] ?? null;
            $payload['auto_generated_product_ids'] = array_values(array_unique(array_filter(array_map('intval', Arr::wrap($options['auto_generated_product_ids'] ?? $demands->pluck('product_id')->all())))));
        }

        return $payload !== [] ? $payload : null;
    }

    private function ensureGroupingThresholdReleased($demands): void
    {
        $blocked = $demands
            ->filter(function (ProcurementDemand $demand): bool {
                return (string) ($demand->order?->supplier_fulfillment_status ?? '') === Order::SUPPLIER_STATUS_GROUPING
                    && $demand->order?->grouping_released_at === null;
            })
            ->groupBy('product_id')
            ->map(function ($rows) {
                /** @var ProcurementDemand|null $first */
                $first = $rows->first();
                $productLabel = $first?->product?->title ?: $first?->product?->name ?: ('Produit #' . ($first?->product_id ?? '?'));
                $threshold = $first && $first->product
                    ? $this->groupedLotService->resolveEffectiveGroupingQuantity($first->product, $first->productSupplierLink)
                    : GroupedLotService::MOQ_BATCH_MULTIPLIER;

                return $productLabel . ' (lot en attente: ' . $threshold . ' unites et ' . (int) GroupedLotService::MINIMUM_LOT_AMOUNT_XOF . ' XOF minimum)';
            })
            ->values()
            ->all();

        if ($blocked === []) {
            return;
        }

        throw new \RuntimeException('Ces articles groupés doivent encore attendre le seuil minimum de commande avant création du lot: ' . implode(', ', array_slice($blocked, 0, 5)) . '.');
    }

    private function ensureSupplierMoqReached($demands): void
    {
        $violations = $demands
            ->groupBy(function (ProcurementDemand $demand) {
                return implode(':', [
                    (int) ($demand->supplier_product_sku_id ?? 0),
                    (int) ($demand->product_id ?? 0),
                    (int) ($demand->product_supplier_link_id ?? 0),
                ]);
            })
            ->map(function ($rows) {
                /** @var ProcurementDemand|null $first */
                $first = $rows->first();
                $required = $first && $first->product
                    ? $this->groupedLotService->resolveEffectiveGroupingQuantity($first->product, $first->productSupplierLink)
                    : GroupedLotService::MOQ_BATCH_MULTIPLIER;
                $requested = (int) $rows->sum('quantity_to_procure');

                if ($requested >= $required) {
                    return null;
                }

                $productLabel = $first?->product?->title ?: $first?->product?->name ?: ('Produit #' . ($first?->product_id ?? '?'));

                return $productLabel . ' (' . $requested . '/' . $required . ')';
            })
            ->filter()
            ->values()
            ->all();

        if ($violations === []) {
            return;
        }

        throw new \RuntimeException('Le MOQ fournisseur n est pas encore atteint pour: ' . implode(', ', array_slice($violations, 0, 5)) . '.');
    }
}