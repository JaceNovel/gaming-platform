<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProcurementBatch;
use App\Models\ProcurementDemand;
use App\Models\Order;
use App\Services\AliExpressProcurementBatchService;
use App\Services\GroupedLotService;
use App\Services\ProcurementBatchService;
use Illuminate\Http\Request;

class AdminProcurementController extends Controller
{
    public function dashboard(Request $request, GroupedLotService $groupedLotService)
    {
        $platform = trim((string) $request->query('platform'));

        $pendingDemandsQuery = ProcurementDemand::query()->where('status', 'pending');
        if ($platform !== '') {
            $pendingDemandsQuery->whereHas('supplierProductSku.supplierProduct.supplierAccount', function ($builder) use ($platform) {
                $builder->where('platform', $platform);
            });
        }

        $pendingDemands = $pendingDemandsQuery->get();

        $unmappedProductsQuery = \App\Models\Product::query()
            ->where('type', 'item')
            ->whereNotNull('accessory_category')
            ->where(function ($query) {
                $query->where('shipping_required', true)
                    ->orWhere('delivery_type', 'preorder');
            })
            ->limit(20);

        if ($platform !== '') {
            $unmappedProductsQuery->whereDoesntHave('productSupplierLinks', function ($builder) use ($platform) {
                $builder->whereHas('supplierProductSku.supplierProduct.supplierAccount', function ($inner) use ($platform) {
                    $inner->where('platform', $platform);
                });
            });
        } else {
            $unmappedProductsQuery->doesntHave('productSupplierLinks');
        }

        $unmappedProducts = $unmappedProductsQuery->get(['id', 'name', 'title', 'stock', 'delivery_type']);

        $moqBlockers = $pendingDemands
            ->groupBy('supplier_product_sku_id')
            ->map(function ($rows) use ($groupedLotService) {
                $first = $rows->first();
                $sku = $first?->supplierProductSku;
                $mapping = $first?->productSupplierLink;
                $required = $first?->product
                    ? $groupedLotService->resolveEffectiveGroupingQuantity($first->product, $mapping)
                    : GroupedLotService::MOQ_BATCH_MULTIPLIER;
                $requested = (int) $rows->sum('quantity_to_procure');

                if ($requested >= $required) {
                    return null;
                }

                return [
                    'supplier_product_sku_id' => $sku?->id,
                    'supplier_account' => $sku?->supplierProduct?->supplierAccount?->label,
                    'product_title' => $sku?->supplierProduct?->title,
                    'sku_label' => $sku?->sku_label,
                    'quantity_to_procure' => $requested,
                    'required_moq' => $required,
                    'missing_to_moq' => $required - $requested,
                ];
            })
            ->filter()
            ->values()
            ->take(20)
            ->all();

        $draftBatchesQuery = ProcurementBatch::query()->where('status', 'draft');
        $submittedBatchesQuery = ProcurementBatch::query()->whereIn('status', ['approved', 'submitted', 'shipped', 'partially_received']);
        $inboundOpenQuery = \App\Models\InboundShipment::query()->whereNotIn('status', ['received', 'closed']);
        $activeSupplierAccountsQuery = \App\Models\SupplierAccount::query()->where('is_active', true);
        $importedSupplierProductsQuery = \App\Models\SupplierProduct::query();
        $activeSupplierSkusQuery = \App\Models\SupplierProductSku::query()->where('is_active', true);

        if ($platform !== '') {
            $draftBatchesQuery->whereHas('supplierAccount', function ($builder) use ($platform) {
                $builder->where('platform', $platform);
            });
            $submittedBatchesQuery->whereHas('supplierAccount', function ($builder) use ($platform) {
                $builder->where('platform', $platform);
            });
            $inboundOpenQuery->whereHas('procurementBatch.supplierAccount', function ($builder) use ($platform) {
                $builder->where('platform', $platform);
            });
            $activeSupplierAccountsQuery->where('platform', $platform);
            $importedSupplierProductsQuery->whereHas('supplierAccount', function ($builder) use ($platform) {
                $builder->where('platform', $platform);
            });
            $activeSupplierSkusQuery->whereHas('supplierProduct.supplierAccount', function ($builder) use ($platform) {
                $builder->where('platform', $platform);
            });
        }

        $draftBatches = $draftBatchesQuery->count();
        $submittedBatches = $submittedBatchesQuery->count();
        $inboundOpen = $inboundOpenQuery->count();

        $logisticsKpis = [
            'grouping_orders' => 0,
            'released_groupings' => 0,
            'shipping_marks_ready' => 0,
            'warehouse_received_orders' => 0,
        ];
        $logisticsOrders = [];

        if ($platform === '' || $platform === 'aliexpress') {
            $aliexpressOrders = Order::query()
                ->with('user:id,name,email')
                ->where('supplier_platform', 'aliexpress');

            $logisticsKpis = [
                'grouping_orders' => (clone $aliexpressOrders)
                    ->where('supplier_fulfillment_status', Order::SUPPLIER_STATUS_GROUPING)
                    ->whereNull('grouping_released_at')
                    ->count(),
                'released_groupings' => (clone $aliexpressOrders)
                    ->whereNotNull('grouping_released_at')
                    ->count(),
                'shipping_marks_ready' => (clone $aliexpressOrders)
                    ->whereNotNull('shipping_mark_pdf_path')
                    ->count(),
                'warehouse_received_orders' => (clone $aliexpressOrders)
                    ->where('supplier_fulfillment_status', Order::SUPPLIER_STATUS_WAREHOUSE_RECEIVED)
                    ->count(),
            ];

            $logisticsOrders = (clone $aliexpressOrders)
                ->latest('id')
                ->limit(20)
                ->get([
                    'id',
                    'reference',
                    'status',
                    'supplier_fulfillment_status',
                    'supplier_country_code',
                    'grouping_released_at',
                    'shipping_mark_pdf_path',
                    'total_price',
                    'created_at',
                    'user_id',
                ])
                ->map(function (Order $order) {
                    return [
                        'id' => $order->id,
                        'reference' => $order->reference,
                        'status' => $order->status,
                        'supplier_fulfillment_status' => $order->supplier_fulfillment_status,
                        'supplier_country_code' => $order->supplier_country_code,
                        'grouping_released_at' => $order->grouping_released_at?->toIso8601String(),
                        'shipping_mark_ready' => !empty($order->shipping_mark_pdf_path),
                        'total_price' => (float) $order->total_price,
                        'created_at' => $order->created_at?->toIso8601String(),
                        'customer_name' => $order->user?->name,
                        'customer_email' => $order->user?->email,
                    ];
                })
                ->all();
        }

        return response()->json([
            'data' => [
                'kpis' => [
                    'active_supplier_accounts' => $activeSupplierAccountsQuery->count(),
                    'imported_supplier_products' => $importedSupplierProductsQuery->count(),
                    'active_supplier_skus' => $activeSupplierSkusQuery->count(),
                    'pending_demands' => $pendingDemands->count(),
                    'pending_quantity_to_procure' => (int) $pendingDemands->sum('quantity_to_procure'),
                    'draft_batches' => $draftBatches,
                    'open_batches' => $submittedBatches,
                    'open_inbound_shipments' => $inboundOpen,
                    'unmapped_products' => $unmappedProducts->count(),
                    'moq_blockers' => count($moqBlockers),
                ],
                'logistics_kpis' => $logisticsKpis,
                'moq_blockers' => $moqBlockers,
                'logistics_orders' => $logisticsOrders,
                'unmapped_products' => $unmappedProducts,
            ],
        ]);
    }

    public function demands(Request $request, GroupedLotService $groupedLotService)
    {
        $query = ProcurementDemand::query()
            ->with([
                'order:id,reference,user_id,supplier_fulfillment_status,grouping_released_at',
                'order.user:id,name,email',
                'orderItem:id,order_id,product_id,quantity,price,delivery_type,delivery_status',
                'product:id,name,title,stock,grouping_threshold',
                'productSupplierLink:id,product_id,supplier_product_sku_id,is_default,warehouse_destination_label,target_moq',
                'supplierProductSku.supplierProduct.supplierAccount:id,platform,label',
                'supplierProductSku:id,supplier_product_id,external_sku_id,sku_label,moq',
                'supplierProductSku.supplierProduct:id,supplier_account_id,title,external_product_id',
            ])
            ->latest('id');

        if ($request->filled('platform')) {
            $query->whereHas('supplierProductSku.supplierProduct.supplierAccount', function ($builder) use ($request) {
                $builder->where('platform', $request->query('platform'));
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $rows = $query->limit(300)->get();
        $pendingBySku = $rows
            ->where('status', 'pending')
            ->groupBy('supplier_product_sku_id')
            ->map(static fn ($items) => (int) $items->sum('quantity_to_procure'));

        return response()->json([
            'data' => $rows->map(function (ProcurementDemand $demand) use ($pendingBySku, $groupedLotService) {
                $requiredMoq = $demand->product
                    ? $groupedLotService->resolveEffectiveGroupingQuantity($demand->product, $demand->productSupplierLink)
                    : GroupedLotService::MOQ_BATCH_MULTIPLIER;
                $pendingQuantity = (int) ($pendingBySku->get($demand->supplier_product_sku_id) ?? 0);
                $lotAmount = ((float) ($demand->orderItem?->price ?? 0)) * (int) ($demand->quantity_to_procure ?? 0);

                return array_merge($demand->toArray(), [
                    'required_moq' => $requiredMoq,
                    'pending_quantity_for_moq' => $pendingQuantity,
                    'missing_to_moq' => max(0, $requiredMoq - $pendingQuantity),
                    'grouping_threshold' => $requiredMoq,
                    'lot_amount' => round($lotAmount, 2),
                    'minimum_lot_amount' => GroupedLotService::MINIMUM_LOT_AMOUNT_XOF,
                    'grouping_ready' => !((string) ($demand->order?->supplier_fulfillment_status ?? '') === Order::SUPPLIER_STATUS_GROUPING
                        && $demand->order?->grouping_released_at === null),
                ]);
            })->values(),
        ]);
    }

    public function batches(Request $request)
    {
        $query = ProcurementBatch::query()
            ->with([
                'supplierAccount:id,platform,label',
                'creator:id,name,email',
                'approver:id,name,email',
                'items.product:id,name,title',
                'items.supplierProductSku.supplierProduct:id,title,external_product_id',
                'inboundShipments.receipts',
            ])
            ->latest('id');

        if ($request->filled('platform')) {
            $query->whereHas('supplierAccount', function ($builder) use ($request) {
                $builder->where('platform', $request->query('platform'));
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        return response()->json([
            'data' => $query->limit(200)->get(),
        ]);
    }

    public function createDraftBatch(Request $request, ProcurementBatchService $batchService)
    {
        $data = $request->validate([
            'demand_ids' => 'required|array|min:1',
            'demand_ids.*' => 'required|integer|exists:procurement_demands,id',
        ]);

        $batch = $batchService->createDraftFromDemandIds($data['demand_ids'], $request->user());

        return response()->json([
            'data' => $batch,
        ], 201);
    }

    public function groupedReady(Request $request, ProcurementBatchService $batchService)
    {
        $platform = trim((string) $request->query('platform')) ?: 'aliexpress';

        return response()->json([
            'data' => $batchService->groupedReadySummary($platform),
        ]);
    }

    public function approveBatch(ProcurementBatch $procurementBatch, Request $request)
    {
        $procurementBatch->update([
            'status' => 'approved',
            'approved_by' => $request->user()?->id,
        ]);

        return response()->json(['data' => $procurementBatch->fresh(['supplierAccount', 'items.product'])]);
    }

    public function submitBatch(ProcurementBatch $procurementBatch, Request $request)
    {
        $data = $request->validate([
            'supplier_order_reference' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
        ]);

        $procurementBatch->update([
            'status' => 'submitted',
            'supplier_order_reference' => trim((string) ($data['supplier_order_reference'] ?? '')) ?: $procurementBatch->supplier_order_reference,
            'notes' => array_key_exists('notes', $data) ? ($data['notes'] ?: null) : $procurementBatch->notes,
            'submitted_at' => now(),
        ]);

        return response()->json(['data' => $procurementBatch->fresh(['supplierAccount', 'items.product'])]);
    }

    public function aliExpressBatchDropshippingDraft(ProcurementBatch $procurementBatch, AliExpressProcurementBatchService $service)
    {
        try {
            $draft = $service->buildDropshippingOrderDraft($procurementBatch);
            $freightCheck = $service->previewDropshippingFreightCheck($procurementBatch, $draft);

            return response()->json([
                'data' => [
                    'draft' => $draft,
                    'freight_check' => $freightCheck,
                ],
                'batch' => $procurementBatch->fresh(['supplierAccount', 'items.product', 'items.supplierProductSku.supplierProduct']),
            ]);
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function aliExpressCreateBatchDropshippingOrder(Request $request, ProcurementBatch $procurementBatch, AliExpressProcurementBatchService $service)
    {
        try {
            $data = $request->validate([
                'ds_extend_request' => 'nullable|array',
                'param_place_order_request4_open_api_d_t_o' => 'nullable|array',
            ]);

            $result = $service->createDropshippingOrder($procurementBatch, $data);

            return response()->json([
                'data' => $result,
                'batch' => $procurementBatch->fresh(['supplierAccount', 'items.product', 'items.supplierProductSku.supplierProduct']),
            ]);
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }
    }
}