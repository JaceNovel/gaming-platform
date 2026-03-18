<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderSupplierFulfillment;
use App\Models\ProductSupplierLink;
use App\Models\SupplierAccount;
use App\Models\SupplierReceivingAddress;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AliExpressOrderFulfillmentService
{
    private const DS_HUB_COUNTRY_CODE = 'FR';

    private const DS_HUB_PROVINCE = 'Yvelines';

    private const REMOTE_ORDER_STATUS_GROUPING = [
        'WAIT_GROUP',
    ];

    private const REMOTE_ORDER_STATUS_PENDING = [
        'PLACE_ORDER_SUCCESS',
        'PAYMENT_PROCESSING',
        'WAIT_SELLER_EXAMINE_MONEY',
        'RISK_CONTROL',
        'RISK_CONTROL_HOLD',
        'WAIT_SELLER_SEND_GOODS',
        'WAIT_COMPLETE_ADDRESS',
    ];

    private const REMOTE_ORDER_STATUS_DELIVERING = [
        'SELLER_PART_SEND_GOODS',
        'SELLER_SEND_PART_GOODS',
        'WAIT_BUYER_ACCEPT_GOODS',
    ];

    private const REMOTE_ORDER_STATUS_DELIVERED = [
        'FIN',
    ];

    private const REMOTE_LOGISTICS_STATUS_DELIVERING = [
        'WAIT_SELLER_SEND_GOODS',
        'SELLER_SEND_PART_GOODS',
        'SELLER_SEND_GOODS',
        'NO_LOGISTICS',
    ];

    private const REMOTE_LOGISTICS_STATUS_DELIVERED = [
        'BUYER_ACCEPT_GOODS',
    ];

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
            'invoice_customer_id' => $this->nullableString($data['invoice_customer_id'] ?? null),
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

    public function buildDropshippingOrderDraft(Order $order): array
    {
        $fulfillment = $this->ensureFulfillment($order);
        $account = $this->resolveSupplierAccount($order, $fulfillment);
        $address = $this->resolveSupplierReceivingAddress($order);

        return [
            'ds_extend_request' => [
                'payment' => [
                    'pay_currency' => 'USD',
                    'try_to_pay' => 'true',
                ],
            ],
            'param_place_order_request4_open_api_d_t_o' => [
                'out_order_id' => $this->buildDsOutOrderId($order),
                'logistics_address' => $this->buildDsLogisticsAddress($address, $this->resolveLocale($fulfillment)),
                'product_items' => $this->buildDsProductItems($order, $account, $fulfillment),
            ],
        ];
    }

    public function previewDropshippingFreightCheck(Order $order, ?array $draft = null): array
    {
        $fulfillment = $this->ensureFulfillment($order);
        $account = $this->resolveSupplierAccount($order, $fulfillment);
        $payload = $draft ?? $this->buildDropshippingOrderDraft($order);

        return $this->runDsFreightPrecheck($order, $account, $payload, $fulfillment);
    }

    public function createDropshippingOrder(Order $order, array $data): array
    {
        $fulfillment = $this->ensureFulfillment($order);
        $account = $this->resolveSupplierAccount($order, $fulfillment);
        $draft = $this->buildDropshippingOrderDraft($order);

        $payload = [
            'ds_extend_request' => is_array($data['ds_extend_request'] ?? null)
                ? $data['ds_extend_request']
                : $draft['ds_extend_request'],
            'param_place_order_request4_open_api_d_t_o' => is_array($data['param_place_order_request4_open_api_d_t_o'] ?? null)
                ? $data['param_place_order_request4_open_api_d_t_o']
                : $draft['param_place_order_request4_open_api_d_t_o'],
        ];

        try {
            $this->validateDsCreatePayload($order, $account, $payload);
        } catch (\RuntimeException $exception) {
            $normalized = [
                'success' => false,
                'is_success' => false,
                'order_list' => [],
                'error_code' => 'DRAFT_VALIDATION_FAILED',
                'remote_error_message' => $exception->getMessage(),
                'request_id' => null,
                'payment_warning' => null,
                'error_message' => $exception->getMessage(),
            ];

            $response = [
                'validation_error' => [
                    'message' => $exception->getMessage(),
                    'payload_summary' => $this->summarizeDsCreatePayload($payload),
                ],
            ];

            $metadata = (array) ($fulfillment->metadata_json ?? []);
            $metadata['ds_order_create'] = array_merge($normalized, [
                'created_at' => now()->toIso8601String(),
            ]);

            $fulfillment->fill([
                'latest_request_payload_json' => $payload,
                'latest_response_payload_json' => $response,
                'metadata_json' => $metadata,
                'last_synced_at' => now(),
                'asf_status' => 'ds_order_failed',
                'asf_sub_status' => 'DRAFT_VALIDATION_FAILED',
            ]);
            $fulfillment->save();

            throw $exception;
        }

        $freightCheck = $this->runDsFreightPrecheck($order, $account, $payload, $fulfillment);
        $freightFailureMessage = $this->describeDsFreightCheckFailure($freightCheck);
        if ($freightFailureMessage !== null) {
            $normalized = [
                'success' => false,
                'is_success' => false,
                'order_list' => [],
                'error_code' => 'FREIGHT_VALIDATION_FAILED',
                'remote_error_message' => $freightFailureMessage,
                'request_id' => null,
                'payment_warning' => null,
                'error_message' => $freightFailureMessage,
            ];

            $response = [
                'freight_check' => $freightCheck,
                'validation_error' => [
                    'message' => $freightFailureMessage,
                    'payload_summary' => $this->summarizeDsCreatePayload($payload),
                ],
            ];

            $metadata = (array) ($fulfillment->metadata_json ?? []);
            $metadata['ds_order_create'] = array_merge($normalized, [
                'created_at' => now()->toIso8601String(),
            ]);
            $metadata['ds_freight_check'] = $freightCheck;

            $fulfillment->fill([
                'latest_request_payload_json' => $payload,
                'latest_response_payload_json' => $response,
                'metadata_json' => $metadata,
                'last_synced_at' => now(),
                'asf_status' => 'ds_order_failed',
                'asf_sub_status' => 'FREIGHT_VALIDATION_FAILED',
            ]);
            $fulfillment->save();

            throw new \RuntimeException($freightFailureMessage);
        }

        try {
            $response = $this->supplierApiClient->iopOperation($account, 'ds-order-create', $payload);
        } catch (\RuntimeException $exception) {
            $this->throwDropshippingPermissionExceptionIfNeeded('ds-order-create', $account, $exception);

            throw $exception;
        }

        $normalized = $this->normalizeDsCreateResult($response);

        $metadata = (array) ($fulfillment->metadata_json ?? []);
        $metadata['ds_order_create'] = array_merge($normalized, [
            'created_at' => now()->toIso8601String(),
        ]);
        $metadata['ds_freight_check'] = $freightCheck;

        $fulfillment->fill([
            'latest_request_payload_json' => $payload,
            'latest_response_payload_json' => $response,
            'metadata_json' => $metadata,
            'last_synced_at' => now(),
        ]);

        if (! $normalized['success']) {
            $fulfillment->asf_status = 'ds_order_failed';
            $fulfillment->asf_sub_status = $normalized['error_code'] ?: 'ds_order_failed';
            $fulfillment->save();

            throw new \RuntimeException($normalized['error_message'] ?: 'La creation de commande DS AliExpress a echoue.');
        }

        $externalOrderId = $normalized['order_list'][0] ?? $this->findFirstStringByKeys($response, ['order_id', 'orderId', 'trade_order_id', 'tradeOrderId']);
        $supplierStatus = $normalized['payment_warning']
            ? Order::SUPPLIER_STATUS_PENDING
            : Order::SUPPLIER_STATUS_PAID;
        $fulfillment->fill([
            'external_order_id' => $externalOrderId,
            'asf_status' => 'ds_order_created',
            'asf_sub_status' => $externalOrderId,
        ]);
        $fulfillment->save();

        $this->syncOrderSummary($order->fresh(), $fulfillment->fresh(), $supplierStatus);

        return [
            'fulfillment' => $fulfillment->fresh(['supplierAccount']),
            'result' => $normalized,
            'response' => $response,
        ];
    }

    public function syncRemoteOrderStatus(Order $order): array
    {
        $fulfillment = $this->ensureFulfillment($order);
        $account = $this->resolveSupplierAccount($order, $fulfillment);
        [$operation, $payload, $sourceLabel] = $this->buildRemoteOrderSyncRequest($fulfillment);

        try {
            $response = $this->supplierApiClient->iopOperation($account, $operation, $payload);
        } catch (\RuntimeException $exception) {
            $this->throwDropshippingPermissionExceptionIfNeeded($operation, $account, $exception);

            throw $exception;
        }

        $snapshot = $this->extractRemoteOrderSnapshot($response);
        $trackingSync = $operation === 'ds-trade-order-get'
            ? $this->syncDropshippingTrackingSnapshot($account, $fulfillment)
            : null;

        if (is_array($trackingSync['snapshot'] ?? null)) {
            $snapshot = array_merge($snapshot, array_filter($trackingSync['snapshot'], static fn ($value) => $value !== null && $value !== ''));
        }

        $supplierStatus = $this->mapRemoteSupplierStatus(
            $snapshot['order_status'] ?? null,
            $snapshot['logistics_status'] ?? null,
            $order->supplier_fulfillment_status,
        );

        $metadata = (array) ($fulfillment->metadata_json ?? []);
        $metadata['remote_order_sync'] = array_merge($snapshot, [
            'source' => $sourceLabel,
            'synced_at' => now()->toIso8601String(),
        ]);
        if ($trackingSync !== null) {
            $metadata['ds_tracking_sync'] = $trackingSync;
        }

        $fulfillment->fill([
            'shipping_provider_code' => $snapshot['shipping_provider_code'] ?? $fulfillment->shipping_provider_code,
            'shipping_provider_name' => $snapshot['shipping_provider_name'] ?? $fulfillment->shipping_provider_name,
            'tracking_number' => $snapshot['tracking_number'] ?? $fulfillment->tracking_number,
            'package_id' => $snapshot['package_id'] ?? $fulfillment->package_id,
            'latest_request_payload_json' => $payload,
            'latest_response_payload_json' => $response,
            'metadata_json' => $metadata,
            'asf_status' => 'remote_order_synced',
            'asf_sub_status' => $snapshot['order_status'] ?? $fulfillment->asf_sub_status,
            'last_synced_at' => now(),
        ]);
        $fulfillment->save();

        $this->syncOrderSummary($order->fresh(), $fulfillment->fresh(), $supplierStatus);

        return [
            'fulfillment' => $fulfillment->fresh(['supplierAccount']),
            'remote' => $snapshot,
            'tracking' => $trackingSync,
            'response' => $response,
            'source' => $sourceLabel,
            'supplier_status' => $supplierStatus,
        ];
    }

    public function queryInvoiceRequest(Order $order, ?string $customerId = null): array
    {
        $fulfillment = $this->ensureFulfillment($order);
        $account = $this->resolveSupplierAccount($order, $fulfillment);
        $resolvedCustomerId = $this->resolveInvoiceCustomerId($fulfillment, $customerId);
        $payload = [
            'orderId' => $this->requireString($fulfillment->external_order_id, 'external_order_id'),
            'customerId' => $resolvedCustomerId,
        ];

        $response = $this->supplierApiClient->iopOperation($account, 'ae-invoice-request-query', $payload);
        $data = is_array($response['data'] ?? null) ? $response['data'] : [];
        $metadata = (array) ($fulfillment->metadata_json ?? []);
        $metadata['invoice_request_data'] = $data;

        $fulfillment->fill([
            'invoice_customer_id' => $data['customerId'] ?? $resolvedCustomerId,
            'invoice_status' => 'request_ready',
            'invoice_latest_request_payload_json' => ['param0' => $payload],
            'invoice_latest_response_payload_json' => $response['raw'] ?? $response,
            'invoice_requested_at' => now(),
            'metadata_json' => $metadata,
            'last_synced_at' => now(),
        ]);
        $fulfillment->save();

        return [
            'invoice_request' => $data,
            'fulfillment' => $fulfillment->fresh(['supplierAccount']),
            'response' => $response,
        ];
    }

    public function uploadBrazilInvoice(Order $order, string $fileName, string $fileContentBase64, string $source = 'ISV'): array
    {
        $fulfillment = $this->ensureFulfillment($order);
        $account = $this->resolveSupplierAccount($order, $fulfillment);
        $this->assertSupportedInvoiceFile($fileName, $fileContentBase64, ['xml'], 3 * 1024 * 1024);

        $payload = [
            'originalFileName' => $fileName,
            'source' => $source,
            'orderId' => $this->requireString($fulfillment->external_order_id, 'external_order_id'),
            '__file_params' => [
                'invoiceData' => [
                    'file_name' => $fileName,
                    'content_base64' => $fileContentBase64,
                ],
            ],
        ];

        $response = $this->supplierApiClient->iopOperation($account, 'ae-brazil-invoice-upload', $payload);
        $storagePath = $this->storeInvoiceDocument($order, $fileContentBase64, $fileName, 'brazil');

        $fulfillment->fill([
            'invoice_status' => 'brazil_xml_uploaded',
            'invoice_file_name' => $fileName,
            'invoice_file_type' => strtolower((string) pathinfo($fileName, PATHINFO_EXTENSION)) ?: 'xml',
            'invoice_file_path' => $storagePath,
            'invoice_latest_request_payload_json' => [
                'originalFileName' => $fileName,
                'source' => $source,
                'orderId' => $payload['orderId'],
            ],
            'invoice_latest_response_payload_json' => $response['raw'] ?? $response,
            'invoice_uploaded_at' => now(),
            'last_synced_at' => now(),
        ]);
        $fulfillment->save();

        return [
            'fulfillment' => $fulfillment->fresh(['supplierAccount']),
            'document_path' => $storagePath,
            'response' => $response,
        ];
    }

    public function pushInvoiceResult(Order $order, array $data): array
    {
        $fulfillment = $this->ensureFulfillment($order);
        $account = $this->resolveSupplierAccount($order, $fulfillment);
        $normalizedData = $this->normalizePushInvoiceData($order, $data);
        $customerId = $this->resolveInvoiceCustomerId($fulfillment, $normalizedData['customer_id'] ?? null);
        $invoiceFileName = (string) $normalizedData['invoice_name'];
        $this->assertSupportedInvoiceFile($invoiceFileName, (string) $normalizedData['invoice_content_base64'], [(string) $normalizedData['invoice_file_type']], 8 * 1024 * 1024);

        $payload = [
            'invoiceStatus' => 'GENERATED_SUCCESS',
            'invoiceDate' => (string) $normalizedData['invoice_date'],
            'invoiceNo' => (string) $normalizedData['invoice_no'],
            'requestNo' => (string) $normalizedData['request_no'],
            'invoiceFileType' => (string) $normalizedData['invoice_file_type'],
            'invoiceDirection' => (string) $normalizedData['invoice_direction'],
            'invoiceName' => $invoiceFileName,
            'orderId' => $this->requireString($fulfillment->external_order_id, 'external_order_id'),
            'customerId' => $customerId,
            '__file_params' => [
                'invoiceData' => [
                    'file_name' => $invoiceFileName,
                    'content_base64' => (string) $normalizedData['invoice_content_base64'],
                ],
            ],
        ];

        $response = $this->supplierApiClient->iopOperation($account, 'ae-invoice-result-push', $payload);
        $storagePath = $this->storeInvoiceDocument($order, (string) $normalizedData['invoice_content_base64'], $invoiceFileName, 'result');

        $fulfillment->fill([
            'invoice_customer_id' => $customerId,
            'invoice_status' => 'invoice_synced',
            'invoice_request_no' => (string) $normalizedData['request_no'],
            'invoice_no' => (string) $normalizedData['invoice_no'],
            'invoice_date' => now()->setTimestampMs((int) $normalizedData['invoice_date']),
            'invoice_file_type' => (string) $normalizedData['invoice_file_type'],
            'invoice_file_name' => $invoiceFileName,
            'invoice_direction' => (string) $normalizedData['invoice_direction'],
            'invoice_file_path' => $storagePath,
            'invoice_latest_request_payload_json' => [
                'invoiceStatus' => 'GENERATED_SUCCESS',
                'invoiceDate' => (string) $normalizedData['invoice_date'],
                'invoiceNo' => (string) $normalizedData['invoice_no'],
                'requestNo' => (string) $normalizedData['request_no'],
                'invoiceFileType' => (string) $normalizedData['invoice_file_type'],
                'invoiceDirection' => (string) $normalizedData['invoice_direction'],
                'invoiceName' => $invoiceFileName,
                'orderId' => $payload['orderId'],
                'customerId' => $customerId,
            ],
            'invoice_latest_response_payload_json' => $response['raw'] ?? $response,
            'invoice_pushed_at' => now(),
            'last_synced_at' => now(),
        ]);
        $fulfillment->save();

        return [
            'fulfillment' => $fulfillment->fresh(['supplierAccount']),
            'document_path' => $storagePath,
            'response' => $response,
        ];
    }

    public function recordInvoiceFailure(Order $order, string $step, \Throwable|string $error, array $context = []): OrderSupplierFulfillment
    {
        $fulfillment = $this->ensureFulfillment($order);
        $metadata = (array) ($fulfillment->metadata_json ?? []);
        $message = $error instanceof \Throwable ? $error->getMessage() : (string) $error;

        $metadata['invoice_last_error'] = [
            'step' => $step,
            'message' => $message,
            'context' => $context,
            'at' => now()->toIso8601String(),
        ];

        $fulfillment->fill([
            'invoice_status' => 'failed_' . $step,
            'invoice_latest_response_payload_json' => [
                'message' => $message,
                'context' => $context,
            ],
            'metadata_json' => $metadata,
            'last_synced_at' => now(),
        ]);
        $fulfillment->save();

        return $fulfillment->fresh(['supplierAccount']);
    }

    public function downloadInvoiceDocument(Order $order): ?string
    {
        $fulfillment = $this->ensureFulfillment($order);

        return $fulfillment->invoice_file_path ?: null;
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

    private function resolveSupplierReceivingAddress(Order $order): SupplierReceivingAddress
    {
        if ($order->supplier_receiving_address_id) {
            $address = SupplierReceivingAddress::query()->find($order->supplier_receiving_address_id);
            if ($address) {
                return $address;
            }
        }

        $address = SupplierReceivingAddress::query()
            ->where('platform', 'aliexpress')
            ->where('recipient_name', 'LAWSON-BODY')
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->first();

        if (! $address) {
            throw new \RuntimeException('Aucune adresse hub AliExpress active n est configuree pour la creation de commande DS.');
        }

        return $address;
    }

    private function buildDsLogisticsAddress(SupplierReceivingAddress $address, string $locale): array
    {
        $mobile = $this->normalizeFrenchPhoneNumber($address->phone);
        $contactName = trim((string) ($address->contact_name ?: $address->recipient_name));

        return array_filter([
            'country' => self::DS_HUB_COUNTRY_CODE,
            'province' => self::DS_HUB_PROVINCE,
            'city' => $address->city,
            'address' => $address->address_line1,
            'address2' => $address->address_line2,
            'zip' => $address->postal_code,
            'contact_person' => $contactName,
            'full_name' => $contactName,
            'mobile_no' => $mobile,
            'phone' => $mobile,
            'phone_country' => '+33',
            'locale' => $locale,
        ], static fn ($value) => $value !== null && $value !== '');
    }

    private function normalizeFrenchPhoneNumber(?string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $phone);
        if ($digits === '') {
            return null;
        }

        if (str_starts_with($digits, '33')) {
            $digits = substr($digits, 2);
        }

        if (str_starts_with($digits, '0')) {
            $digits = substr($digits, 1);
        }

        return $digits !== '' ? $digits : null;
    }

    private function buildDsProductItems(Order $order, SupplierAccount $account, OrderSupplierFulfillment $fulfillment): array
    {
        $order->loadMissing(['orderItems.product.productSupplierLinks.supplierProductSku.supplierProduct.supplierAccount']);

        $items = [];
        foreach ($order->orderItems as $orderItem) {
            $product = $orderItem->product;
            if (! $product || (! $orderItem->is_physical && ! $product->shipping_required)) {
                continue;
            }

            $link = $this->resolveDsProductLink($orderItem, $account->id);
            if (! $link) {
                throw new \RuntimeException('Aucun mapping AliExpress actif trouve pour le produit: ' . ($product->name ?? ('#' . $product->id)) . '.');
            }

            $supplierSku = $link->supplierProductSku;
            $supplierProduct = $supplierSku?->supplierProduct;
            $productId = trim((string) ($supplierProduct?->external_product_id ?? ''));
            if ($productId === '') {
                throw new \RuntimeException('Le produit fournisseur AliExpress n a pas de product_id externe pour: ' . ($product->name ?? ('#' . $product->id)) . '.');
            }

            $item = array_filter([
                'product_id' => $productId,
                'sku_attr' => $supplierSku ? $this->resolveDsSkuAttr($supplierSku->sku_payload_json ?? [], $supplierSku->variant_attributes_json ?? []) : null,
                'product_count' => (string) max(1, (int) ($orderItem->quantity ?? 1)),
                'logistics_service_name' => $this->resolveDsLogisticsServiceName($link, $fulfillment),
                'order_memo' => 'Hub France-Lome seulement. Reference interne: ' . ($order->reference ?? ('order-' . $order->id)),
            ], static fn ($value) => $value !== null && $value !== '');

            $items[] = $item;
        }

        if ($items === []) {
            throw new \RuntimeException('Aucune ligne physique exploitable n est disponible pour la creation de commande DS.');
        }

        return array_values($items);
    }

    private function resolveDsLogisticsServiceName(ProductSupplierLink $link, OrderSupplierFulfillment $fulfillment): ?string
    {
        $supplierSku = $link->supplierProductSku;
        $supplierProduct = $supplierSku?->supplierProduct;

        $candidate = $this->nullableString(
            data_get($supplierSku?->sku_payload_json, 'logistics_service_name')
            ?? data_get($supplierSku?->sku_payload_json, 'service_name')
            ?? data_get($supplierSku?->sku_payload_json, 'serviceName')
            ?? data_get($link->pricing_snapshot_json, 'logistics_service_name')
            ?? data_get($supplierProduct?->attributes_json, 'logistics_service_name')
            ?? data_get($supplierProduct?->product_payload_json, 'result.logistics_info_dto.logistics_service_name')
            ?? data_get($supplierProduct?->product_payload_json, 'result.logistics_info_dto.service_name')
            ?? data_get($supplierProduct?->product_payload_json, 'raw.result.logistics_info_dto.logistics_service_name')
            ?? data_get($supplierProduct?->product_payload_json, 'raw.result.logistics_info_dto.service_name')
            ?? $this->findFirstStringByKeys(is_array($supplierProduct?->product_payload_json) ? $supplierProduct->product_payload_json : [], ['logistics_service_name', 'service_name', 'serviceName', 'shipping_service_name', 'shippingServiceName'])
            ?? $fulfillment->shipping_provider_name
            ?? config('services.sourcing.platforms.aliexpress.ds_default_logistics_service_name')
        );

        return $candidate;
    }

    private function validateDsCreatePayload(Order $order, SupplierAccount $account, array $payload): void
    {
        $request = is_array($payload['param_place_order_request4_open_api_d_t_o'] ?? null)
            ? $payload['param_place_order_request4_open_api_d_t_o']
            : [];
        $payCurrency = $this->nullableString(data_get($payload, 'ds_extend_request.payment.pay_currency')) ?: 'USD';
        $items = array_values(array_filter(
            is_array($request['product_items'] ?? null) ? $request['product_items'] : [],
            static fn ($item) => is_array($item)
        ));

        if ($items === []) {
            throw new \RuntimeException('Le draft DS ne contient aucun product_items exploitable.');
        }

        $order->loadMissing(['orderItems.product.productSupplierLinks.supplierProductSku.supplierProduct.supplierAccount']);

        $physicalItems = [];
        foreach ($order->orderItems as $orderItem) {
            $product = $orderItem->product;
            if (! $product || (! $orderItem->is_physical && ! $product->shipping_required)) {
                continue;
            }

            $physicalItems[] = $orderItem;
        }

        $issues = [];
        foreach ($items as $index => $item) {
            $orderItem = $physicalItems[$index] ?? null;
            $productLabel = $orderItem?->product?->name ?: ('Ligne DS #' . ($index + 1));

            $productId = $this->nullableString($item['product_id'] ?? null);
            if ($productId === null) {
                $issues[] = $productLabel . ': product_id manquant.';
            }

            $logisticsServiceName = $this->nullableString($item['logistics_service_name'] ?? null);
            if ($logisticsServiceName === null) {
                $issues[] = $productLabel . ': logistics_service_name manquant. Ouvre le draft DS et choisis un service logistique AliExpress valide avant de creer la commande.';
            }

            if ($orderItem !== null) {
                $link = $this->resolveDsProductLink($orderItem, $account->id);
                $variantAttributes = is_array($link?->supplierProductSku?->variant_attributes_json ?? null)
                    ? $link->supplierProductSku->variant_attributes_json
                    : [];
                $skuAttr = $this->nullableString($item['sku_attr'] ?? null);

                if ($skuAttr === null && $variantAttributes !== []) {
                    $issues[] = $productLabel . ': sku_attr manquant alors que le SKU DS contient des variations. Relie le produit au bon SKU DS puis regenere le draft.';
                }
            }
        }

        $payCurrency = $this->nullableString(data_get($payload, 'ds_extend_request.payment.pay_currency'));
        if ($payCurrency !== null && strtoupper($payCurrency) !== 'USD') {
            $issues[] = 'La devise DS doit rester USD pour la creation de commande AliExpress.';
        }

        if ($issues !== []) {
            throw new \RuntimeException('Le draft DS est incomplet: ' . implode(' ', $issues));
        }
    }

    private function summarizeDsCreatePayload(array $payload): array
    {
        $request = is_array($payload['param_place_order_request4_open_api_d_t_o'] ?? null)
            ? $payload['param_place_order_request4_open_api_d_t_o']
            : [];
        $items = array_values(array_filter(
            is_array($request['product_items'] ?? null) ? $request['product_items'] : [],
            static fn ($item) => is_array($item)
        ));

        return array_filter([
            'out_order_id' => $this->nullableString($request['out_order_id'] ?? null),
            'pay_currency' => $this->nullableString(data_get($payload, 'ds_extend_request.payment.pay_currency')),
            'product_items' => array_map(function (array $item): array {
                return array_filter([
                    'product_id' => $this->nullableString($item['product_id'] ?? null),
                    'sku_attr' => $this->nullableString($item['sku_attr'] ?? null),
                    'product_count' => $this->nullableString($item['product_count'] ?? null),
                    'logistics_service_name' => $this->nullableString($item['logistics_service_name'] ?? null),
                ], static fn ($value) => $value !== null && $value !== '');
            }, $items),
        ], static fn ($value) => $value !== null && $value !== '');
    }

    private function runDsFreightPrecheck(Order $order, SupplierAccount $account, array $payload, ?OrderSupplierFulfillment $fulfillment = null): array
    {
        $locale = $fulfillment ? $this->resolveLocale($fulfillment) : 'fr_FR';
        $language = $this->resolveLanguageFromLocale($locale);
        $request = is_array($payload['param_place_order_request4_open_api_d_t_o'] ?? null)
            ? $payload['param_place_order_request4_open_api_d_t_o']
            : [];
        $payCurrency = $this->nullableString(data_get($payload, 'ds_extend_request.payment.pay_currency')) ?: 'USD';
        $items = array_values(array_filter(
            is_array($request['product_items'] ?? null) ? $request['product_items'] : [],
            static fn ($item) => is_array($item)
        ));

        $order->loadMissing(['orderItems.product.productSupplierLinks.supplierProductSku.supplierProduct.supplierAccount']);
        $physicalItems = [];
        foreach ($order->orderItems as $orderItem) {
            $product = $orderItem->product;
            if (! $product || (! $orderItem->is_physical && ! $product->shipping_required)) {
                continue;
            }

            $physicalItems[] = $orderItem;
        }

        $checks = [];
        foreach ($items as $index => $item) {
            $orderItem = $physicalItems[$index] ?? null;
            $link = $orderItem ? $this->resolveDsProductLink($orderItem, $account->id) : null;
            $supplierSku = $link?->supplierProductSku;
            $productLabel = $orderItem?->product?->name ?: ('Ligne DS #' . ($index + 1));
            $requestedService = $this->nullableString($item['logistics_service_name'] ?? null);
            $skuId = $this->nullableString($supplierSku?->external_sku_id ?? null);
            $productId = $this->nullableString($item['product_id'] ?? null);
            $shipToCountry = $this->nullableString($order->shipping_country_code ?: null) ?: self::DS_HUB_COUNTRY_CODE;

            $freightPayload = array_filter([
                'queryDeliveryReq' => array_filter([
                    'locale' => $locale,
                    'language' => $language,
                    'currency' => $payCurrency,
                    'shipToCountry' => $shipToCountry,
                    'productId' => $productId,
                    'selectedSkuId' => $skuId,
                    'quantity' => (int) ($item['product_count'] ?? 1) > 0 ? (int) $item['product_count'] : 1,
                ], static fn ($value) => $value !== null && $value !== ''),
            ], static fn ($value) => $value !== null && $value !== '');

            if ($productId === null || $skuId === null) {
                $checks[] = [
                    'product_name' => $productLabel,
                    'requested_logistics_service_name' => $requestedService,
                    'success' => false,
                    'error_message' => 'Precheck freight impossible: product_id ou sku_id manquant.',
                    'available_services' => [],
                ];
                continue;
            }

            try {
                $response = $this->supplierApiClient->iopOperation($account, 'ds-freight-query', $freightPayload);
                $availableServices = $this->extractFreightServiceNames($response);
                $checks[] = [
                    'product_name' => $productLabel,
                    'product_id' => $productId,
                    'sku_id' => $skuId,
                    'requested_logistics_service_name' => $requestedService,
                    'available_services' => $availableServices,
                    'is_valid' => $requestedService === null ? null : in_array($requestedService, $availableServices, true),
                    'success' => true,
                    'request_payload' => $freightPayload,
                    'response' => $response,
                ];
            } catch (\Throwable $exception) {
                $checks[] = [
                    'product_name' => $productLabel,
                    'product_id' => $productId,
                    'sku_id' => $skuId,
                    'requested_logistics_service_name' => $requestedService,
                    'available_services' => [],
                    'success' => false,
                    'error_message' => $exception->getMessage(),
                    'request_payload' => $freightPayload,
                ];
            }
        }

        return [
            'checked_at' => now()->toIso8601String(),
            'items' => $checks,
        ];
    }

    private function describeDsFreightCheckFailure(array $freightCheck): ?string
    {
        foreach (Arr::wrap($freightCheck['items'] ?? []) as $item) {
            if (!is_array($item)) {
                continue;
            }

            if (($item['success'] ?? true) === false) {
                return trim((string) (($item['product_name'] ?? 'Produit') . ': ' . ($item['error_message'] ?? 'Precheck freight impossible.')));
            }

            if (($item['is_valid'] ?? null) === false) {
                $available = implode(', ', array_slice(array_values(array_filter(Arr::wrap($item['available_services'] ?? []), 'is_string')), 0, 8));

                return trim((string) (($item['product_name'] ?? 'Produit') . ': logistics_service_name invalide pour ce SKU DS.' . ($available !== '' ? ' Services disponibles: ' . $available : '')));
            }
        }

        return null;
    }

    private function extractFreightServiceNames(array $payload): array
    {
        $serviceNames = [];
        $queue = [$payload];

        while ($queue !== []) {
            $node = array_shift($queue);
            if (!is_array($node)) {
                continue;
            }

            foreach ($node as $key => $value) {
                if (is_array($value)) {
                    $queue[] = $value;
                    continue;
                }

                if (!is_string($key)) {
                    continue;
                }

                $normalizedKey = strtolower($key);
                if (!in_array($normalizedKey, ['service_name', 'servicename', 'logistics_service_name', 'logisticsservicename', 'company', 'company_name'], true)) {
                    continue;
                }

                $stringValue = trim((string) $value);
                if ($stringValue !== '') {
                    $serviceNames[] = $stringValue;
                }
            }
        }

        return array_values(array_unique($serviceNames));
    }

    private function resolveDsProductLink(OrderItem $orderItem, int $supplierAccountId): ?ProductSupplierLink
    {
        $product = $orderItem->product;
        if (! $product) {
            return null;
        }

        $links = [];
        foreach ($product->productSupplierLinks as $link) {
            $account = $link->supplierProductSku?->supplierProduct?->supplierAccount;
            if (! $account || (int) $account->id !== $supplierAccountId || (string) $account->platform !== 'aliexpress') {
                continue;
            }

            $links[] = $link;
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

        return $links[0];
    }

    private function resolveDsSkuAttr(array $skuPayload, array $variantAttributes): ?string
    {
        $pairs = [];
        foreach ($variantAttributes as $key => $value) {
            if (is_array($value)) {
                $propertyId = $value['property_id'] ?? $value['attr_id'] ?? $value['id'] ?? null;
                $propertyValueId = $value['property_value_id'] ?? $value['value_id'] ?? $value['vid'] ?? null;
                if ($propertyId !== null && $propertyValueId !== null) {
                    $pairs[] = $propertyId . ':' . $propertyValueId;
                }

                continue;
            }

            if ($key !== '' && $value !== null && $value !== '') {
                $pairs[] = $key . ':' . $value;
            }
        }

        if ($pairs !== []) {
            return implode(';', $pairs);
        }

        $direct = $this->nullableString($skuPayload['skuAttr'] ?? $skuPayload['sku_attr'] ?? null);
        if (! $direct) {
            return null;
        }

        $normalizedSegments = [];
        foreach (preg_split('/\s*;\s*/', $direct) ?: [] as $segment) {
            $segment = trim((string) $segment);
            if ($segment === '') {
                continue;
            }

            $segment = trim((string) preg_replace('/#.*/', '', $segment));
            if (preg_match('/^\d+:\d+$/', $segment) === 1) {
                $normalizedSegments[] = $segment;
            }
        }

        if ($normalizedSegments !== []) {
            return implode(';', $normalizedSegments);
        }

        return $direct;
    }

    private function buildDsOutOrderId(Order $order): string
    {
        $reference = Str::slug((string) ($order->reference ?? ('order-' . $order->id)), '-');

        return Str::limit('gp-' . $order->id . '-' . $reference, 64, '');
    }

    private function normalizeDsCreateResult(array $payload): array
    {
        $orderList = array_values(array_filter(array_map(
            static fn ($value) => trim((string) $value),
            Arr::wrap($this->findFirstArrayByKeys($payload, ['order_list', 'orderList']) ?? [])
        )));

        if ($orderList === []) {
            $singleOrderId = $this->findFirstStringByKeys($payload, ['order_id', 'orderId', 'trade_order_id', 'tradeOrderId']);
            if ($singleOrderId !== null) {
                $orderList = [$singleOrderId];
            }
        }

        $rawSuccess = $this->findFirstBooleanByKeys($payload, ['is_success', 'isSuccess', 'success']);
        $errorCode = $this->findFirstStringByKeys($payload, ['error_code', 'errorCode']);
        $remoteErrorMessage = $this->findFirstStringByKeys($payload, ['error_msg', 'errorMessage', 'error_message', 'sub_msg', 'subMessage']);
        $requestId = $this->findFirstStringByKeys($payload, ['request_id', 'requestId']);
        $success = $orderList !== [] || ($rawSuccess === true && $errorCode === null && $remoteErrorMessage === null);

        $resolvedErrorMessage = $success
            ? null
            : $this->describeDsCreateError($errorCode, $remoteErrorMessage, $requestId);

        return [
            'success' => $success,
            'is_success' => $rawSuccess,
            'order_list' => $orderList,
            'error_code' => $errorCode,
            'remote_error_message' => $remoteErrorMessage,
            'request_id' => $requestId,
            'payment_warning' => $success && ($errorCode !== null || $remoteErrorMessage !== null)
                ? ($remoteErrorMessage ?: $errorCode)
                : null,
            'error_message' => $resolvedErrorMessage,
        ];
    }

    private function describeDsCreateError(?string $errorCode, ?string $remoteMessage, ?string $requestId = null): string
    {
        $message = match ($errorCode) {
            'B_DROPSHIPPER_DELIVERY_ADDRESS_VALIDATE_FAIL' => 'Adresse fournisseur hub invalide pour AliExpress. Verifie le draft d adresse France.',
            'B_DROPSHIPPER_DELIVERY_ADDRESS_CPF_CN_INVALID', 'B_DROPSHIPPER_DELIVERY_ADDRESS_CPF_NOT_MATCH' => 'Le document fiscal demande par AliExpress est invalide pour cette destination.',
            'BLACKLIST_BUYER_IN_LIST', 'USER_ACCOUNT_DISABLED' => 'Le compte AliExpress connecte est invalide ou desactive. Essaie un autre compte fournisseur.',
            'PRICE_PAY_CURRENCY_ERROR' => 'Tous les articles de la commande DS doivent utiliser la meme devise de paiement.',
            'DELIVERY_METHOD_NOT_EXIST' => 'Le logistics_service_name est invalide. Lance d abord une verification freight puis corrige le draft.',
            'INVENTORY_HOLD_ERROR' => 'Stock insuffisant ou indisponible cote AliExpress.',
            'REPEATED_ORDER_ERROR' => 'Commande dupliquee detectee par AliExpress.',
            'ERROR_WHEN_BUILD_FOR_PLACE_ORDER', 'A001_ORDER_CANNOT_BE_PLACED', 'A002_INVALID_ZONE', 'A003_SUSPICIOUS_BUYER', 'A004_CANNOT_USER_COUPON', 'A005_INVALID_COUNTRIES', 'A006_INVALID_ACCOUNT_INFO' => 'AliExpress refuse la creation de commande DS pour cette combinaison compte/zone/promotion.',
            default => $remoteMessage ?: 'La creation de commande DS AliExpress a echoue. Verifie logistics_service_name, sku_attr et le compte DS utilise.',
        };

        if ($requestId !== null && !str_contains($message, 'request_id')) {
            $message .= ' request_id=' . $requestId;
        }

        return $message;
    }

    private function throwDropshippingPermissionExceptionIfNeeded(string $operation, SupplierAccount $account, \RuntimeException $exception): void
    {
        if (!in_array($operation, ['ds-order-create', 'ds-trade-order-get'], true)) {
            return;
        }

        $message = (string) $exception->getMessage();
        if (!str_contains($message, 'InsufficientPermission')) {
            return;
        }

        throw new \RuntimeException(
            'Le compte AliExpress "' . ($account->label ?? ('#' . $account->id)) . '" n\'a pas les permissions Dropshipping pour cette API. Active les scopes DS sur l\'application AliExpress, reconnecte le compte OAuth, puis relance la creation de commande DS.',
            previous: $exception,
        );
    }

    private function extractRemoteOrderSnapshot(array $response): array
    {
        $orderStatus = $this->findFirstStringByKeys($response, ['order_status', 'orderStatus']);
        $logisticsStatus = $this->findFirstStringByKeys($response, ['logistics_status', 'logisticsStatus']);

        return array_filter([
            'order_status' => $orderStatus,
            'order_status_label' => $this->describeRemoteOrderStatus($orderStatus),
            'logistics_status' => $logisticsStatus,
            'logistics_status_label' => $this->describeRemoteLogisticsStatus($logisticsStatus),
            'tracking_number' => $this->findFirstStringByKeys($response, ['tracking_number', 'trackingNumber', 'logistics_no', 'logisticsNo', 'mail_no', 'mailNo']),
            'shipping_provider_code' => $this->findFirstStringByKeys($response, ['service_provider', 'serviceProvider', 'logistics_company_code', 'logisticsCompanyCode']),
            'shipping_provider_name' => $this->findFirstStringByKeys($response, ['service_name', 'serviceName', 'logistics_company_name', 'logisticsCompanyName', 'shipping_provider_name']),
            'package_id' => $this->findFirstStringByKeys($response, ['package_id', 'packageId']),
        ], static fn ($value) => $value !== null && $value !== '');
    }

    private function buildRemoteOrderSyncRequest(OrderSupplierFulfillment $fulfillment): array
    {
        $externalOrderId = $this->requireString($fulfillment->external_order_id, 'external_order_id');
        $locale = $this->resolveLocale($fulfillment);

        if ($this->isDropshippingExternalOrder($fulfillment)) {
            return [
                'ds-trade-order-get',
                [
                    'single_order_query' => [
                        'order_id' => $externalOrderId,
                    ],
                ],
                'trade.ds.order.get',
            ];
        }

        return [
            'order-get',
            [
                'tradeOrderId' => $externalOrderId,
                'locale' => $locale,
            ],
            'Order.get',
        ];
    }

    private function syncDropshippingTrackingSnapshot(SupplierAccount $account, OrderSupplierFulfillment $fulfillment): array
    {
        try {
            $payload = [
                'ae_order_id' => $this->requireString($fulfillment->external_order_id, 'external_order_id'),
                'language' => $this->resolveLocale($fulfillment),
            ];

            $response = $this->supplierApiClient->iopOperation($account, 'ds-order-tracking-get', $payload);
            $snapshot = $this->extractDsTrackingSnapshot($response);

            return array_merge($snapshot, [
                'synced_at' => now()->toIso8601String(),
                'request_payload' => $payload,
            ]);
        } catch (
            \Throwable $exception
        ) {
            return [
                'success' => false,
                'error_message' => $exception->getMessage(),
                'synced_at' => now()->toIso8601String(),
            ];
        }
    }

    private function extractDsTrackingSnapshot(array $response): array
    {
        $result = is_array($response['result'] ?? null) ? $response['result'] : [];
        $success = filter_var($result['ret'] ?? null, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        $code = $this->nullableString($result['code'] ?? null);
        $message = $this->nullableString($result['msg'] ?? $result['error_msg'] ?? null);
        $lines = Arr::wrap(data_get($result, 'data.tracking_detail_line_list', []));
        $primaryLine = is_array($lines[0] ?? null) ? $lines[0] : [];
        $detailNodes = array_values(array_filter(Arr::wrap($primaryLine['detail_node_list'] ?? []), 'is_array'));

        return [
            'success' => $success !== false,
            'code' => $code,
            'message' => $message,
            'tracking_number' => $this->nullableString($primaryLine['mail_no'] ?? null),
            'shipping_provider_name' => $this->nullableString($primaryLine['carrier_name'] ?? null),
            'eta_timestamp' => $this->nullableString($primaryLine['eta_time_stamps'] ?? null),
            'tracking_detail_line_list' => $lines,
            'latest_event' => is_array($detailNodes[0] ?? null) ? $detailNodes[0] : null,
            'snapshot' => array_filter([
                'tracking_number' => $this->nullableString($primaryLine['mail_no'] ?? null),
                'shipping_provider_name' => $this->nullableString($primaryLine['carrier_name'] ?? null),
            ], static fn ($value) => $value !== null && $value !== ''),
            'raw' => $response,
        ];
    }

    private function isDropshippingExternalOrder(OrderSupplierFulfillment $fulfillment): bool
    {
        $dsOrderCreate = data_get($fulfillment->metadata_json, 'ds_order_create');

        return is_array($dsOrderCreate) && !empty($dsOrderCreate['order_list']);
    }

    private function mapRemoteSupplierStatus(?string $orderStatus, ?string $logisticsStatus, ?string $currentStatus = null): ?string
    {
        $normalizedOrder = strtoupper(trim((string) $orderStatus));
        $normalizedLogistics = strtoupper(trim((string) $logisticsStatus));

        if (in_array($normalizedOrder, self::REMOTE_ORDER_STATUS_GROUPING, true)) {
            return Order::SUPPLIER_STATUS_GROUPING;
        }

        if (in_array($normalizedOrder, self::REMOTE_ORDER_STATUS_DELIVERED, true)
            || in_array($normalizedLogistics, self::REMOTE_LOGISTICS_STATUS_DELIVERED, true)) {
            return Order::SUPPLIER_STATUS_DELIVERED;
        }

        if (in_array($normalizedOrder, self::REMOTE_ORDER_STATUS_DELIVERING, true)
            || in_array($normalizedLogistics, self::REMOTE_LOGISTICS_STATUS_DELIVERING, true)) {
            return Order::SUPPLIER_STATUS_DELIVERING;
        }

        if (in_array($normalizedOrder, self::REMOTE_ORDER_STATUS_PENDING, true)) {
            return Order::SUPPLIER_STATUS_PENDING;
        }

        if ($normalizedOrder === 'IN_CANCEL') {
            return $currentStatus ?: Order::SUPPLIER_STATUS_PENDING;
        }

        return $currentStatus;
    }

    private function describeRemoteOrderStatus(?string $status): ?string
    {
        return match (strtoupper(trim((string) $status))) {
            'PLACE_ORDER_SUCCESS' => 'Commande passee avec succes',
            'PAYMENT_PROCESSING' => 'Traitement des paiements',
            'WAIT_SELLER_EXAMINE_MONEY' => 'En attente de validation vendeur du montant',
            'RISK_CONTROL' => 'Controle des risques en cours',
            'RISK_CONTROL_HOLD' => 'Controle des risques maintenu',
            'WAIT_SELLER_SEND_GOODS' => 'En attente que le vendeur expedie',
            'SELLER_PART_SEND_GOODS', 'SELLER_SEND_PART_GOODS' => 'Expedition partielle',
            'WAIT_BUYER_ACCEPT_GOODS' => 'En attente de reception acheteur',
            'FIN' => 'Commande terminee',
            'IN_CANCEL' => 'Commande annulee',
            'WAIT_GROUP' => 'En attente de formation du groupe',
            'WAIT_COMPLETE_ADDRESS' => 'En attente de completion adresse',
            default => $status ?: null,
        };
    }

    private function describeRemoteLogisticsStatus(?string $status): ?string
    {
        return match (strtoupper(trim((string) $status))) {
            'WAIT_SELLER_SEND_GOODS' => 'En attente expedition vendeur',
            'SELLER_SEND_PART_GOODS' => 'Expedition partielle',
            'SELLER_SEND_GOODS' => 'Expedie par le vendeur',
            'BUYER_ACCEPT_GOODS' => 'Reception acheteur',
            'NO_LOGISTICS' => 'Aucune logistique',
            default => $status ?: null,
        };
    }

    private function findFirstStringByKeys(array $payload, array $keys): ?string
    {
        $needle = array_flip(array_map(static fn ($key) => strtolower($key), $keys));
        $queue = [$payload];

        while ($queue !== []) {
            $node = array_shift($queue);
            if (!is_array($node)) {
                continue;
            }

            foreach ($node as $key => $value) {
                if (is_string($key) && isset($needle[strtolower($key)]) && !is_array($value)) {
                    $stringValue = trim((string) $value);
                    if ($stringValue !== '') {
                        return $stringValue;
                    }
                }

                if (is_array($value)) {
                    $queue[] = $value;
                }
            }
        }

        return null;
    }

    private function findFirstArrayByKeys(array $payload, array $keys): ?array
    {
        $needle = array_flip(array_map(static fn ($key) => strtolower($key), $keys));
        $queue = [$payload];

        while ($queue !== []) {
            $node = array_shift($queue);
            if (!is_array($node)) {
                continue;
            }

            foreach ($node as $key => $value) {
                if (is_string($key) && isset($needle[strtolower($key)]) && is_array($value)) {
                    return $value;
                }

                if (is_array($value)) {
                    $queue[] = $value;
                }
            }
        }

        return null;
    }

    private function findFirstBooleanByKeys(array $payload, array $keys): ?bool
    {
        $needle = array_flip(array_map(static fn ($key) => strtolower($key), $keys));
        $queue = [$payload];

        while ($queue !== []) {
            $node = array_shift($queue);
            if (!is_array($node)) {
                continue;
            }

            foreach ($node as $key => $value) {
                if (is_string($key) && isset($needle[strtolower($key)]) && !is_array($value)) {
                    $resolved = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                    if ($resolved !== null) {
                        return $resolved;
                    }
                }

                if (is_array($value)) {
                    $queue[] = $value;
                }
            }
        }

        return null;
    }

    private function normalizePushInvoiceData(Order $order, array $data): array
    {
        $invoiceFileType = strtolower((string) ($data['invoice_file_type'] ?? 'pdf'));
        $invoiceNo = trim((string) ($data['invoice_no'] ?? ''));

        if ($invoiceNo === '') {
            throw new \RuntimeException('invoice_no est obligatoire.');
        }

        $requestNo = trim((string) ($data['request_no'] ?? ''));
        if ($requestNo === '') {
            $requestNo = 'ae-inv-' . $order->id . '-' . Str::lower(Str::random(10));
        }

        $invoiceDate = (int) ($data['invoice_date'] ?? 0);
        if ($invoiceDate <= 0) {
            $invoiceDate = (int) now()->getTimestampMs();
        }

        return [
            'customer_id' => $this->nullableString($data['customer_id'] ?? null),
            'invoice_no' => $invoiceNo,
            'request_no' => $requestNo,
            'invoice_date' => $invoiceDate,
            'invoice_file_type' => $invoiceFileType,
            'invoice_direction' => strtoupper((string) ($data['invoice_direction'] ?? 'BLUE')),
            'invoice_name' => $this->resolveInvoiceFileName($invoiceNo, $invoiceFileType, $data['invoice_name'] ?? null),
            'invoice_content_base64' => (string) ($data['invoice_content_base64'] ?? ''),
        ];
    }

    private function resolveInvoiceFileName(string $invoiceNo, string $invoiceFileType, mixed $rawFileName): string
    {
        $fileName = trim((string) $rawFileName);
        if ($fileName === '') {
            $fileName = 'invoice-' . Str::slug($invoiceNo, '-') . '.' . $invoiceFileType;
        }

        $extension = strtolower((string) pathinfo($fileName, PATHINFO_EXTENSION));
        if ($extension !== $invoiceFileType) {
            $fileName = pathinfo($fileName, PATHINFO_FILENAME) . '.' . $invoiceFileType;
        }

        return $fileName;
    }

    private function assertSupportedInvoiceFile(string $fileName, string $fileContentBase64, array $allowedExtensions, int $maxBytes): void
    {
        $extension = strtolower((string) pathinfo($fileName, PATHINFO_EXTENSION));
        if (!in_array($extension, $allowedExtensions, true)) {
            throw new \RuntimeException('Extension de fichier facture invalide: ' . $extension . '.');
        }

        $decoded = base64_decode($fileContentBase64, true);
        if ($decoded === false) {
            throw new \RuntimeException('Le contenu du fichier facture n est pas un base64 valide.');
        }

        if (strlen($decoded) === 0) {
            throw new \RuntimeException('Le fichier facture est vide.');
        }

        if (strlen($decoded) > $maxBytes) {
            throw new \RuntimeException('Le fichier facture depasse la taille autorisee.');
        }
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

    private function resolveLanguageFromLocale(string $locale): string
    {
        $normalized = trim($locale);
        if ($normalized === '') {
            return 'fr';
        }

        $parts = preg_split('/[-_]/', $normalized);
        $language = strtolower(trim((string) ($parts[0] ?? '')));

        return $language !== '' ? $language : 'fr';
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

    private function storeInvoiceDocument(Order $order, string $contentBase64, string $fileName, string $prefix): ?string
    {
        $binary = base64_decode($contentBase64, true);
        if ($binary === false) {
            return null;
        }

        $extension = strtolower((string) pathinfo($fileName, PATHINFO_EXTENSION)) ?: 'bin';
        $baseName = pathinfo($fileName, PATHINFO_FILENAME);
        $path = 'orders/aliexpress/' . $order->id . '/' . $prefix . '-' . Str::slug($baseName) . '.' . $extension;
        Storage::disk('public')->put($path, $binary);

        return $path;
    }

    private function resolveInvoiceCustomerId(OrderSupplierFulfillment $fulfillment, ?string $customerId = null): string
    {
        $resolved = trim((string) ($customerId ?: $fulfillment->invoice_customer_id ?: data_get($fulfillment->metadata_json, 'invoice.customer_id')));
        if ($resolved === '') {
            throw new \RuntimeException('Champ requis manquant pour la facturation AliExpress: invoice_customer_id.');
        }

        return $resolved;
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