<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InboundShipment;
use App\Services\WarehouseReceiptService;
use Illuminate\Http\Request;

class AdminInboundShipmentController extends Controller
{
    public function index(Request $request)
    {
        $query = InboundShipment::query()
            ->with([
                'procurementBatch.supplierAccount:id,platform,label',
                'procurementBatch.items.product:id,name,title',
                'receipts.receiver:id,name,email',
                'receipts.items.product:id,name,title',
            ])
            ->latest('id');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        return response()->json([
            'data' => $query->limit(200)->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'procurement_batch_id' => 'required|exists:procurement_batches,id',
            'shipment_reference' => 'nullable|string|max:255',
            'carrier_name' => 'nullable|string|max:255',
            'tracking_number' => 'nullable|string|max:255',
            'tracking_url' => 'nullable|url|max:2048',
            'status' => 'nullable|string|max:32',
        ]);

        $shipment = InboundShipment::create([
            'procurement_batch_id' => $data['procurement_batch_id'],
            'shipment_reference' => trim((string) ($data['shipment_reference'] ?? '')) ?: null,
            'carrier_name' => trim((string) ($data['carrier_name'] ?? '')) ?: null,
            'tracking_number' => trim((string) ($data['tracking_number'] ?? '')) ?: null,
            'tracking_url' => trim((string) ($data['tracking_url'] ?? '')) ?: null,
            'status' => trim((string) ($data['status'] ?? '')) ?: 'pending',
        ]);

        return response()->json([
            'data' => $shipment->fresh(['procurementBatch.supplierAccount']),
        ], 201);
    }

    public function storeReceipt(Request $request, WarehouseReceiptService $warehouseReceiptService)
    {
        $data = $request->validate([
            'inbound_shipment_id' => 'required|exists:inbound_shipments,id',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.procurement_batch_item_id' => 'nullable|integer|exists:procurement_batch_items,id',
            'items.*.product_id' => 'nullable|integer|exists:products,id',
            'items.*.supplier_product_sku_id' => 'nullable|integer|exists:supplier_product_skus,id',
            'items.*.quantity_received' => 'required|integer|min:1',
            'items.*.quantity_damaged' => 'nullable|integer|min:0',
            'items.*.quantity_missing' => 'nullable|integer|min:0',
        ]);

        $shipment = InboundShipment::query()->findOrFail((int) $data['inbound_shipment_id']);
        $receipt = $warehouseReceiptService->receive($shipment, $data, $request->user());

        return response()->json([
            'data' => $receipt,
        ], 201);
    }
}