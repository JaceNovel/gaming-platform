<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderSupplierFulfillment;
use App\Models\ProductSupplierLink;
use App\Models\SupplierAccount;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AliExpressOrderFulfillmentService
{
    public function __construct(private readonly SupplierApiClient $supplierApiClient)
    {
    }

    public function saveContext(Order $order, array $data): OrderSupplierFulfillment
    {
        $fulfillment = $this->ensureFulfillment($order);

        if (!empty($data['supplier_account_id'])) {
            $account = SupplierAccount::query()->findOrFail((int) $data['supplier_account_id']);
            if ((string) $account->platform !== 'aliexpress') {
                throw new \RuntimeException('Le compte fournisseur doit etre un compte AliExpress.');
            }
            $fulfillment->supplier_account_id = $account->id;
        }

        $mapped = [
            'external_order_id' => $this->nullableString($data['external_order_id'] ?? null),
            'seller_id' => $this->nullableString($data['seller_id'] ?? null),
            'locale' => $this->nullableString($data['locale'] ?? null) ?: 'fr_FR',
            'shipping_mode' => $this->nullableString($data['shipping_mode'] ?? null),
            'shipping_provider_code' => $this->nullableString($data['shipping_provider_code'] ?? null),
            'shipping_provider_name' => $this->nullableString($data['shipping_provider_name'] ?? null),
            'carrier_code' => $this->nullableString($data['carrier_code'] ?? null),
            'tracking_number' => $this->nullableString($data['tracking_number'] ?? null),
            'package_id' => $this->nullableString($data['package_id'] ?? null),
            'pickup_address_id' => $this->nullableString($data['pickup_address_id'] ?? null),
            'refund_address_id' => $this->nullableString($data['refund_address_id'] ?? null),
        ];

        foreach ($mapped as $field => $value) {
            if (array_key_exists($field, $data)) {
                $fulfillment->{$field} = $value;
            }
        }

        if (array_key_exists('external_order_lines', $data)) {
            $fulfillment->external_order_lines_json = $this->normalizeExternalOrderLines($data['external_order_lines']);
        }

        $fulfillment->save();

        $this->syncOrderSummary($order->fresh(), $fulfillment->fresh());

        return $fulfillment->fresh(['supplierAccount']);
    }

    public function resolveShippingMode(Order $order): array
    {
        $fulfillment = $this->ensureFulfillment($order);
        $account = $this->resolveSupplierAccount($order, $fulfillment);
        $payload = [
            'tradeOrderId' => $this->requireString($fulfillment->external_order_id, 'external_order_id'),
            'locale' => $this->resolveLocale($fulfillment),
            'tradeOrderItemIdList' => $this->tradeOrderItemIds($fulfillment),
        ];

        $response = $this->supplierApiClient->iopOperation($account, 'ae-asf-order-shipping-service-get', $payload);
        $services = Arr::wrap(data_get($response, 'result.data.orderShippingServiceList', []));
        $primary = is_array($services[0] ?? null) ? $services[0] : [];

        $fulfillment->fill([
            'shipping_mode' => $this->mapShippingMode((string) ($primary['shipmentServiceDeliveryMode'] ?? '')),
            'shipping_provider_code' => $primary['shipmentServiceCode'] ?? $fulfillment->shipping_provider_code,
            'shipping_provider_name' => $primary['shipmentServiceName'] ?? $fulfillment->shipping_provider_name,
            'resolved_shipping_services_json' => $services,
            'latest_request_payload_json' => $payload,
            'latest_response_payload_json' => $response,
            'asf_status' => 'mode_resolved',
            'asf_sub_status' => $primary['shipmentServiceDeliveryMode'] ?? null,
            'last_synced_at' => now(),
        ]);
        $fulfillment->save();

        $this->syncOrderSummary($order->fresh(), $fulfillment->fresh());

        return [
            'mode' => $fulfillment->shipping_mode,
            'services' => $services,
            'fulfillment' => $fulfillment->fresh(['supplierAccount']),
        ];
    }

    public function pack(Order $order): array
    {
        $fulfillment = $this->ensureFulfillment($order);
        $account = $this->resolveSupplierAccount($order, $fulfillment);
        $mode = $this->resolveActionableMode($order, $fulfillment);

        if ($mode === 'dbs') {
            throw new \RuntimeException('Le mode DBS ne necessite pas de pack distinct. Utilise directement Ship.');
        }

        if ($mode === 'platform_logistics') {
            $payload = [
                'tradeOrderId' => $this->requireString($fulfillment->external_order_id, 'external_order_id'),
                'tradeOrderItemIdList' => $this->tradeOrderItemObjects($fulfillment),
                'addressId' => $this->requireString($fulfillment->pickup_address_id, 'pickup_address_id'),
                'locale' => $this->resolveLocale($fulfillment),
                'sendOption' => data_get($fulfillment->metadata_json, 'sendOption'),
                'solutionCode' => data_get($fulfillment->metadata_json, 'solutionCode'),
            ];

            $response = $this->supplierApiClient->iopOperation($account, 'ae-asf-shipment-pack', $payload);
            $resultData = data_get($response, 'result.data', []);

            $fulfillment->fill([
                'package_id' => $resultData['packageId'] ?? $fulfillment->package_id,
                'tracking_number' => $resultData['trackingNumber'] ?? $fulfillment->tracking_number,
                'latest_request_payload_json' => $payload,
                'latest_response_payload_json' => $response,
                'asf_status' => 'packed',
                'packed_at' => now(),
                'last_synced_at' => now(),
            ]);
            $fulfillment->save();
            $this->syncOrderSummary($order->fresh(), $fulfillment->fresh(), Order::SUPPLIER_STATUS_SUPPLIER_ORDERED);

            return ['fulfillment' => $fulfillment->fresh(['supplierAccount']), 'response' => $response];
        }

        $payload = [
            'sellerId' => $this->resolveSellerId($account, $fulfillment),
            'tradeOrderId' => $this->requireString($fulfillment->external_order_id, 'external_order_id'),
            'tradeOrderItemSupportItemDTOS' => $this->tradeOrderSupportItems($fulfillment),
            'addressId' => $this->requireString($fulfillment->pickup_address_id, 'pickup_address_id'),
            'refundAddressId' => $fulfillment->refund_address_id,
            'sendOption' => data_get($fulfillment->metadata_json, 'sendOption'),
            'solutionCode' => data_get($fulfillment->metadata_json, 'solutionCode'),
        ];

        $response = $this->supplierApiClient->iopOperation($account, 'ae-asf-local2local-split-quantity-rts-pack', $payload);
        $resultData = $response['data'] ?? [];

        $fulfillment->fill([
            'package_id' => $resultData['fulfillmentPackageId'] ?? $fulfillment->package_id,
            'tracking_number' => $resultData['trackingNumber'] ?? $fulfillment->tracking_number,
            'latest_request_payload_json' => $payload,
            'latest_response_payload_json' => $response,
            'asf_status' => 'packed',
            'packed_at' => now(),
            'last_synced_at' => now(),
        ]);
        $fulfillment->save();
        $this->syncOrderSummary($order->fresh(), $fulfillment->fresh(), Order::SUPPLIER_STATUS_SUPPLIER_ORDERED);

        return ['fulfillment' => $fulfillment->fresh(['supplierAccount']), 'response' => $response];
    }

    public function ship(Order $order): array
    {
        $fulfillment = $this->ensureFulfillment($order);
        $account = $this->resolveSupplierAccount($order, $fulfillment);
        $mode = $this->resolveActionableMode($order, $fulfillment);

        [$operation, $payload] = match ($mode) {
            'dbs' => [
                'ae-asf-dbs-declareship',
                [
                    'tradeOrderId' => $this->requireString($fulfillment->external_order_id, 'external_order_id'),
                    'shipmentProviderCode' => $this->requireString($fulfillment->shipping_provider_code, 'shipping_provider_code'),
                    'trackingNumber' => $this->requireString($fulfillment->tracking_number, 'tracking_number'),
                    'tradeOrderItemIdList' => $this->tradeOrderItemObjects($fulfillment),
                    'locale' => $this->resolveLocale($fulfillment),
                    'carrierCode' => $fulfillment->carrier_code,
                ],
            ],
            'platform_logistics' => [
                'ae-asf-platform-logistics-rts',
                [
                    'packageId' => $fulfillment->package_id,
                    'tradeOrderId' => $this->requireString($fulfillment->external_order_id, 'external_order_id'),
                    'locale' => $this->resolveLocale($fulfillment),
                    'trackingNumber' => $fulfillment->tracking_number,
                ],
            ],
            'local2local_self_pickup' => [
                'ae-asf-local2local-self-pickup-declareship',
                [
                    'tradeOrderId' => $this->requireString($fulfillment->external_order_id, 'external_order_id'),
                    'tradeOrderLineList' => $this->tradeOrderLineIds($fulfillment),
                    'sellerId' => $this->resolveSellerId($account, $fulfillment),
                ],
            ],
            'local2local_offline' => [
                'ae-asf-local2local-transfer-to-offline',
                [
                    'tradeOrderId' => $this->requireString($fulfillment->external_order_id, 'external_order_id'),
                    'subTradeOrderList' => $this->subTradeOrderList($fulfillment, true),
                    'sellerId' => $this->resolveSellerId($account, $fulfillment),
                    'packageId' => $fulfillment->package_id,
                ],
            ],
            default => [
                'ae-asf-local2local-sub-declareship',
                [
                    'tradeOrderId' => $this->requireString($fulfillment->external_order_id, 'external_order_id'),
                    'subTradeOrderList' => $this->subTradeOrderList($fulfillment, false),
                    'sellerId' => $this->resolveSellerId($account, $fulfillment),
                ],
            ],
        };

        $response = $this->supplierApiClient->iopOperation($account, $operation, $payload);

        $fulfillment->fill([
            'latest_request_payload_json' => $payload,
            'latest_response_payload_json' => $response,
            'asf_status' => 'shipped',
            'shipped_at' => now(),
            'last_synced_at' => now(),
        ]);
        $fulfillment->save();
        $this->syncOrderSummary($order->fresh(), $fulfillment->fresh(), Order::SUPPLIER_STATUS_DELIVERING);

        return ['fulfillment' => $fulfillment->fresh(['supplierAccount']), 'response' => $response];
    }

    public function repack(Order $order): array
    {
        $fulfillment = $this->ensureFulfillment($order);
        $account = $this->resolveSupplierAccount($order, $fulfillment);
        $mode = $this->resolveActionableMode($order, $fulfillment);

        [$operation, $payload] = match ($mode) {
            'dbs' => [
                'ae-asf-dbs-declare-ship-modify',
                [
                    'tradeOrderId' => $this->requireString($fulfillment->external_order_id, 'external_order_id'),
                    'newShipmentProviderCode' => $this->requireString($fulfillment->shipping_provider_code, 'shipping_provider_code'),
                    'newTrackingNumber' => $this->requireString($fulfillment->tracking_number, 'tracking_number'),
                    'locale' => $this->resolveLocale($fulfillment),
                    'oldTrackingNumber' => $this->requireString(data_get($fulfillment->metadata_json, 'old_tracking_number') ?? $fulfillment->tracking_number, 'old_tracking_number'),
                    'carrierCode' => $fulfillment->carrier_code,
                ],
            ],
            'platform_logistics' => [
                'ae-asf-platform-logistics-repack',
                [
                    'tradeOrderId' => $this->requireString($fulfillment->external_order_id, 'external_order_id'),
                    'locale' => $this->resolveLocale($fulfillment),
                    'trackingNumber' => $fulfillment->tracking_number,
                    'packageId' => $fulfillment->package_id,
                ],
            ],
            default => throw new \RuntimeException('Repack n est pas supporte pour ce mode d expedition AliExpress.'),
        };

        $response = $this->supplierApiClient->iopOperation($account, $operation, $payload);

        $fulfillment->fill([
            'latest_request_payload_json' => $payload,
            'latest_response_payload_json' => $response,
            'asf_status' => 'repacked',
            'repacked_at' => now(),
            'last_synced_at' => now(),
        ]);
        $fulfillment->save();
        $this->syncOrderSummary($order->fresh(), $fulfillment->fresh(), Order::SUPPLIER_STATUS_SUPPLIER_ORDERED);

        return ['fulfillment' => $fulfillment->fresh(['supplierAccount']), 'response' => $response];
    }

    public function printWaybill(Order $order, string $documentType = 'WAY_BILL'): array
    {
        $fulfillment = $this->ensureFulfillment($order);
        $account = $this->resolveSupplierAccount($order, $fulfillment);
        $mode = $this->resolveActionableMode($order, $fulfillment);

        if ($mode !== 'platform_logistics') {
            throw new \RuntimeException('Print waybill est disponible uniquement pour le mode platform_logistics.');
        }

        $payload = [
            'documentType' => $documentType,
            'queryDocumentRequestList' => [[
                'tradeOrderId' => $this->requireString($fulfillment->external_order_id, 'external_order_id'),
                'packageId' => $this->requireString($fulfillment->package_id, 'package_id'),
                'trackingNumber' => $fulfillment->tracking_number,
            ]],
            'locale' => $this->resolveLocale($fulfillment),
        ];

        $response = $this->supplierApiClient->iopOperation($account, 'ae-asf-platform-logistics-document-query', $payload);
        $data = data_get($response, 'result.data', []);
        $bytes = $data['bytes'] ?? null;
        $url = $data['fileUrl'] ?? null;
        $storagePath = $this->storeWaybillDocument($order, $bytes, $documentType);

        $fulfillment->fill([
            'latest_document_type' => $documentType,
            'document_url' => $url,
            'document_bytes_base64' => $bytes,
            'latest_request_payload_json' => $payload,
            'latest_response_payload_json' => $response,
            'asf_status' => 'waybill_ready',
            'waybill_printed_at' => now(),
            'last_synced_at' => now(),
        ]);
        $fulfillment->save();

        $order->forceFill([
            'shipping_document_path' => $storagePath,
        ])->save();
        $this->syncOrderSummary($order->fresh(), $fulfillment->fresh());

        return [
            'fulfillment' => $fulfillment->fresh(['supplierAccount']),
            'document_path' => $storagePath,
            'response' => $response,
        ];
    }

    public function ensureFulfillment(Order $order): OrderSupplierFulfillment
    {
        return DB::transaction(function () use ($order) {
            $fulfillment = OrderSupplierFulfillment::query()->firstOrCreate(
                [
                    'order_id' => $order->id,
                    'platform' => 'aliexpress',
                ],
                [
                    'locale' => 'fr_FR',
                ]
            );

            if (!$fulfillment->supplier_account_id) {
                $account = $this->guessAliExpressSupplierAccount($order);
                if ($account) {
                    $fulfillment->supplier_account_id = $account->id;
                    $fulfillment->save();
                }
            }

            return $fulfillment;
        });
    }

    private function resolveSupplierAccount(Order $order, OrderSupplierFulfillment $fulfillment): SupplierAccount
    {
        if ($fulfillment->supplier_account_id) {
            return SupplierAccount::query()->findOrFail($fulfillment->supplier_account_id);
        }

        $account = $this->guessAliExpressSupplierAccount($order);
        if (!$account) {
            throw new \RuntimeException('Aucun compte fournisseur AliExpress resolu pour cette commande.');
        }

        $fulfillment->supplier_account_id = $account->id;
        $fulfillment->save();

        return $account;
    }

    private function guessAliExpressSupplierAccount(Order $order): ?SupplierAccount
    {
        $order->loadMissing(['orderItems.product.productSupplierLinks.supplierProductSku.supplierProduct.supplierAccount']);
        $links = [];

        foreach ($order->orderItems as $orderItem) {
            $product = $orderItem->product;
            if (!$product) {
                continue;
            }

            foreach ($product->productSupplierLinks as $link) {
                $account = $link->supplierProductSku?->supplierProduct?->supplierAccount;
                if (!$account || (string) $account->platform !== 'aliexpress') {
                    continue;
                }

                $links[] = $link;
            }
        }

        if ($links === []) {
            return null;
        }

        usort($links, function (ProductSupplierLink $left, ProductSupplierLink $right) {
            if ($left->is_default !== $right->is_default) {
                return $left->is_default ? -1 : 1;
            }

            return (int) ($left->priority ?? 1) <=> (int) ($right->priority ?? 1);
        });

        return $links[0]->supplierProductSku?->supplierProduct?->supplierAccount;
    }

    private function syncOrderSummary(Order $order, OrderSupplierFulfillment $fulfillment, ?string $supplierStatus = null): void
    {
        $account = $fulfillment->relationLoaded('supplierAccount')
            ? $fulfillment->supplierAccount
            : ($fulfillment->supplier_account_id ? SupplierAccount::query()->find($fulfillment->supplier_account_id) : null);

        $updates = [
            'supplier_platform' => 'aliexpress',
            'supplier_account_id' => $account?->id,
            'supplier_external_order_id' => $fulfillment->external_order_id,
            'supplier_shipping_mode' => $fulfillment->shipping_mode,
            'supplier_package_id' => $fulfillment->package_id,
            'supplier_tracking_number' => $fulfillment->tracking_number,
            'supplier_shipping_provider_code' => $fulfillment->shipping_provider_code,
            'supplier_shipping_provider_name' => $fulfillment->shipping_provider_name,
            'supplier_document_url' => $fulfillment->document_url,
        ];

        if ($supplierStatus !== null) {
            $updates['supplier_fulfillment_status'] = $supplierStatus;
        }

        $order->forceFill($updates)->save();
    }

    private function resolveActionableMode(Order $order, OrderSupplierFulfillment $fulfillment): string
    {
        $mode = (string) ($fulfillment->shipping_mode ?? '');
        if ($mode !== '') {
            return $mode;
        }

        return (string) ($this->resolveShippingMode($order)['mode'] ?? 'platform_logistics');
    }

    private function resolveLocale(OrderSupplierFulfillment $fulfillment): string
    {
        return $fulfillment->locale ?: 'fr_FR';
    }

    private function resolveSellerId(SupplierAccount $account, OrderSupplierFulfillment $fulfillment): string
    {
        return $this->requireString($fulfillment->seller_id ?: $account->member_id, 'seller_id');
    }

    private function tradeOrderItemIds(OrderSupplierFulfillment $fulfillment): array
    {
        $lines = Arr::wrap($fulfillment->external_order_lines_json ?? []);
        $ids = [];
        foreach ($lines as $line) {
            if (is_array($line)) {
                $value = $line['tradeOrderItemId'] ?? $line['tradeOrderLineId'] ?? null;
            } else {
                $value = $line;
            }

            if ($value !== null && $value !== '') {
                $ids[] = is_numeric($value) ? (int) $value : (string) $value;
            }
        }

        if ($ids === []) {
            throw new \RuntimeException('Aucune ligne de commande AliExpress n est configuree sur ce fulfillment.');
        }

        return array_values($ids);
    }

    private function tradeOrderItemObjects(OrderSupplierFulfillment $fulfillment): array
    {
        return array_map(static fn ($id) => ['tradeOrderItemId' => (string) $id], $this->tradeOrderItemIds($fulfillment));
    }

    private function tradeOrderLineIds(OrderSupplierFulfillment $fulfillment): array
    {
        $lines = Arr::wrap($fulfillment->external_order_lines_json ?? []);
        $ids = [];
        foreach ($lines as $line) {
            if (is_array($line)) {
                $value = $line['tradeOrderLineId'] ?? $line['tradeOrderItemId'] ?? null;
            } else {
                $value = $line;
            }

            if ($value !== null && $value !== '') {
                $ids[] = (string) $value;
            }
        }

        if ($ids === []) {
            throw new \RuntimeException('Aucune tradeOrderLineId n est configuree sur ce fulfillment.');
        }

        return array_values($ids);
    }

    private function tradeOrderSupportItems(OrderSupplierFulfillment $fulfillment): array
    {
        $lines = Arr::wrap($fulfillment->external_order_lines_json ?? []);
        if ($lines === []) {
            throw new \RuntimeException('Aucune ligne AliExpress n est configuree pour le pack split quantity.');
        }

        return array_map(static function ($line) {
            if (!is_array($line)) {
                return [
                    'tradeOrderItemId' => (string) $line,
                    'quantity' => '1',
                ];
            }

            return [
                'tradeOrderItemId' => (string) ($line['tradeOrderItemId'] ?? $line['tradeOrderLineId'] ?? ''),
                'quantity' => (string) ($line['quantity'] ?? 1),
            ];
        }, $lines);
    }

    private function subTradeOrderList(OrderSupplierFulfillment $fulfillment, bool $includeQuantity): array
    {
        $lines = Arr::wrap($fulfillment->external_order_lines_json ?? []);
        if ($lines === []) {
            throw new \RuntimeException('Aucune ligne AliExpress n est configuree pour la declaration d expedition.');
        }

        return array_map(function ($line) use ($includeQuantity) {
            if (!is_array($line)) {
                return [
                    'tradeOrderLineId' => (string) $line,
                    'shipmentList' => [[
                        'quantity' => $includeQuantity ? '1' : null,
                        'carrierCode' => null,
                        'logisticsNo' => null,
                        'serviceName' => null,
                    ]],
                ];
            }

            $shipments = Arr::wrap($line['shipmentList'] ?? []);
            if ($shipments === []) {
                $shipments = [[
                    'quantity' => $line['quantity'] ?? 1,
                    'carrierCode' => $line['carrierCode'] ?? null,
                    'logisticsNo' => $line['logisticsNo'] ?? null,
                    'serviceName' => $line['serviceName'] ?? null,
                ]];
            }

            $normalizedShipments = array_map(static function ($shipment) use ($includeQuantity) {
                return array_filter([
                    'quantity' => $includeQuantity ? (string) ($shipment['quantity'] ?? 1) : null,
                    'carrierCode' => $shipment['carrierCode'] ?? null,
                    'logisticsNo' => $shipment['logisticsNo'] ?? null,
                    'serviceName' => $shipment['serviceName'] ?? null,
                ], static fn ($value) => $value !== null && $value !== '');
            }, $shipments);

            return array_filter([
                'sendType' => $line['sendType'] ?? null,
                'tradeOrderLineId' => (string) ($line['tradeOrderLineId'] ?? $line['tradeOrderItemId'] ?? ''),
                'shipmentList' => $normalizedShipments,
            ], static fn ($value) => $value !== null && $value !== '');
        }, $lines);
    }

    private function mapShippingMode(string $rawMode): string
    {
        $normalized = strtoupper(trim($rawMode));
        if ($normalized === '') {
            return 'platform_logistics';
        }

        if (str_contains($normalized, 'DBS')) {
            return 'dbs';
        }

        if (str_contains($normalized, 'SELF') && str_contains($normalized, 'PICK')) {
            return 'local2local_self_pickup';
        }

        if (str_contains($normalized, 'OFFLINE')) {
            return 'local2local_offline';
        }

        if (str_contains($normalized, 'LOCAL')) {
            return 'local2local';
        }

        return 'platform_logistics';
    }

    private function storeWaybillDocument(Order $order, ?string $bytes, string $documentType): ?string
    {
        if (!$bytes) {
            return null;
        }

        $binary = base64_decode($bytes, true);
        if ($binary === false) {
            return null;
        }

        $path = 'orders/aliexpress/' . $order->id . '/waybill-' . Str::slug(strtolower($documentType)) . '.pdf';
        Storage::disk('public')->put($path, $binary);

        return $path;
    }

    private function normalizeExternalOrderLines(mixed $value): array
    {
        $lines = Arr::wrap($value);

        return array_values(array_filter(array_map(static function ($line) {
            if (is_string($line) || is_numeric($line)) {
                return ['tradeOrderItemId' => (string) $line, 'quantity' => 1];
            }

            return is_array($line) ? $line : null;
        }, $lines)));
    }

    private function requireString(?string $value, string $field): string
    {
        $resolved = trim((string) $value);
        if ($resolved === '') {
            throw new \RuntimeException('Champ requis manquant pour le fulfillment AliExpress: ' . $field);
        }

        return $resolved;
    }

    private function nullableString(mixed $value): ?string
    {
        $resolved = trim((string) $value);
        return $resolved === '' ? null : $resolved;
    }
}