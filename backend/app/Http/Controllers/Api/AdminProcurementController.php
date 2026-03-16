<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProcurementBatch;
use App\Models\ProcurementDemand;
use App\Services\ProcurementBatchService;
use Illuminate\Http\Request;

class AdminProcurementController extends Controller
{
    public function dashboard()
    {
        $pendingDemands = ProcurementDemand::query()->where('status', 'pending')->get();

        $unmappedProducts = \App\Models\Product::query()
            ->where('type', 'item')
            ->whereNotNull('accessory_category')
            ->where(function ($query) {
                $query->where('shipping_required', true)
                    ->orWhere('delivery_type', 'preorder');
            })
            ->doesntHave('productSupplierLinks')
            ->limit(20)
            ->get(['id', 'name', 'title', 'stock', 'delivery_type']);

        $moqBlockers = $pendingDemands
            ->groupBy('supplier_product_sku_id')
            ->map(function ($rows) {
                $first = $rows->first();
                $sku = $first?->supplierProductSku;
                $mapping = $first?->productSupplierLink;
                $required = max(1, (int) ($mapping?->target_moq ?? $sku?->moq ?? 1));
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

        $draftBatches = ProcurementBatch::query()->where('status', 'draft')->count();
        $submittedBatches = ProcurementBatch::query()->whereIn('status', ['approved', 'submitted', 'shipped', 'partially_received'])->count();
        $inboundOpen = \App\Models\InboundShipment::query()->whereNotIn('status', ['received', 'closed'])->count();

        return response()->json([
            'data' => [
                'kpis' => [
                    'active_supplier_accounts' => \App\Models\SupplierAccount::query()->where('is_active', true)->count(),
                    'imported_supplier_products' => \App\Models\SupplierProduct::query()->count(),
                    'active_supplier_skus' => \App\Models\SupplierProductSku::query()->where('is_active', true)->count(),
                    'pending_demands' => $pendingDemands->count(),
                    'pending_quantity_to_procure' => (int) $pendingDemands->sum('quantity_to_procure'),
                    'draft_batches' => $draftBatches,
                    'open_batches' => $submittedBatches,
                    'open_inbound_shipments' => $inboundOpen,
                    'unmapped_products' => $unmappedProducts->count(),
                    'moq_blockers' => count($moqBlockers),
                ],
                'moq_blockers' => $moqBlockers,
                'unmapped_products' => $unmappedProducts,
            ],
        ]);
    }

    public function demands(Request $request)
    {
        $query = ProcurementDemand::query()
            ->with([
                'order.user:id,name,email',
                'orderItem:id,order_id,product_id,quantity,delivery_type,delivery_status',
                'product:id,name,title,stock',
                'productSupplierLink:id,product_id,supplier_product_sku_id,is_default,warehouse_destination_label',
                'supplierProductSku.supplierProduct.supplierAccount:id,platform,label',
                'supplierProductSku.supplierProduct:id,supplier_account_id,title,external_product_id',
            ])
            ->latest('id');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        return response()->json([
            'data' => $query->limit(300)->get(),
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
}