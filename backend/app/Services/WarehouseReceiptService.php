<?php

namespace App\Services;

use App\Models\InboundShipment;
use App\Models\ProcurementBatchItem;
use App\Models\WarehouseReceipt;
use App\Models\WarehouseReceiptItem;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class WarehouseReceiptService
{
    public function receive(InboundShipment $shipment, array $payload, ?User $admin = null): WarehouseReceipt
    {
        return DB::transaction(function () use ($shipment, $payload, $admin) {
            $receipt = WarehouseReceipt::create([
                'inbound_shipment_id' => $shipment->id,
                'received_by' => $admin?->id,
                'received_at' => now(),
                'notes' => trim((string) ($payload['notes'] ?? '')) ?: null,
            ]);

            foreach ((array) ($payload['items'] ?? []) as $line) {
                $batchItem = null;
                if (!empty($line['procurement_batch_item_id'])) {
                    $batchItem = ProcurementBatchItem::with('demandCoverages.procurementDemand')
                        ->findOrFail((int) $line['procurement_batch_item_id']);
                }

                $product = $batchItem?->product;
                if (!$product && !empty($line['product_id'])) {
                    $product = \App\Models\Product::query()->findOrFail((int) $line['product_id']);
                }

                $quantityReceived = max(0, (int) ($line['quantity_received'] ?? 0));
                $quantityDamaged = max(0, (int) ($line['quantity_damaged'] ?? 0));
                $quantityMissing = max(0, (int) ($line['quantity_missing'] ?? 0));
                $netStock = max(0, $quantityReceived - $quantityDamaged);

                $movement = null;
                if ($product && $netStock > 0) {
                    $movement = app(StockService::class)->adjustProductStock(
                        $product,
                        $netStock,
                        'warehouse_receipt',
                        $admin,
                        [
                            'inbound_shipment_id' => $shipment->id,
                            'procurement_batch_item_id' => $batchItem?->id,
                        ]
                    );
                }

                WarehouseReceiptItem::create([
                    'warehouse_receipt_id' => $receipt->id,
                    'procurement_batch_item_id' => $batchItem?->id,
                    'product_id' => $product?->id,
                    'supplier_product_sku_id' => $batchItem?->supplier_product_sku_id ?? ($line['supplier_product_sku_id'] ?? null),
                    'quantity_received' => $quantityReceived,
                    'quantity_damaged' => $quantityDamaged,
                    'quantity_missing' => $quantityMissing,
                    'stock_movement_id' => $movement?->id,
                ]);

                if ($batchItem) {
                    $receivedSoFar = (int) WarehouseReceiptItem::query()
                        ->where('procurement_batch_item_id', $batchItem->id)
                        ->sum('quantity_received');

                    if ($receivedSoFar >= (int) $batchItem->quantity_ordered) {
                        foreach ($batchItem->demandCoverages as $coverage) {
                            $coverage->procurementDemand?->update(['status' => 'received']);
                        }
                    }
                }
            }

            $shipment->refresh();
            $shipment->update(['received_at' => now(), 'status' => 'received']);

            $batch = $shipment->procurementBatch()->with('items')->first();
            if ($batch) {
                $allReceived = $batch->items->every(function ($item) {
                    $received = (int) WarehouseReceiptItem::query()
                        ->where('procurement_batch_item_id', $item->id)
                        ->sum('quantity_received');
                    return $received >= (int) $item->quantity_ordered;
                });

                $batch->update(['status' => $allReceived ? 'received' : 'partially_received']);
            }

            return $receipt->fresh(['items.product', 'items.procurementBatchItem', 'receiver', 'inboundShipment.procurementBatch']);
        });
    }
}