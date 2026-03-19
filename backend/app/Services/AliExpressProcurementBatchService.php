<?php

namespace App\Services;

use App\Models\ProcurementBatch;
use App\Models\ProcurementBatchItem;
use App\Models\ProductSupplierLink;
use App\Models\SupplierAccount;
use App\Models\SupplierProductSku;
use App\Models\SupplierReceivingAddress;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class AliExpressProcurementBatchService
{
    private const DS_HUB_COUNTRY_CODE = 'FR';

    private const DS_HUB_PROVINCE = 'Yvelines';

    public function __construct(
        private readonly SupplierApiClient $supplierApiClient,
    ) {
    }

    public function buildDropshippingOrderDraft(ProcurementBatch $batch): array
    {
        $batch->loadMissing([
            'supplierAccount',
            'items.product',
            'items.productSupplierLink.supplierProductSku.supplierProduct.supplierAccount',
            'items.supplierProductSku.supplierProduct.supplierAccount',
            'items.demandCoverages.procurementDemand.order',
        ]);

        $account = $this->resolveSupplierAccount($batch);
        $address = $this->resolveSupplierReceivingAddress($batch);
        $draft = [
            'ds_extend_request' => [
                'payment' => [
                    'pay_currency' => 'USD',
                    'try_to_pay' => 'true',
                ],
            ],
            'param_place_order_request4_open_api_d_t_o' => [
                'out_order_id' => $this->buildDsOutOrderId($batch),
                'logistics_address' => $this->buildDsLogisticsAddress($address, 'fr_FR'),
                'product_items' => $this->buildDsProductItems($batch, $account),
            ],
        ];

        $this->persistBatchPayload($batch, [
            'ds_draft' => $draft,
        ]);

        return $draft;
    }

    public function previewDropshippingFreightCheck(ProcurementBatch $batch, ?array $draft = null): array
    {
        $batch->loadMissing([
            'supplierAccount',
            'items.product',
            'items.productSupplierLink.supplierProductSku.supplierProduct.supplierAccount',
            'items.supplierProductSku.supplierProduct.supplierAccount',
        ]);

        $account = $this->resolveSupplierAccount($batch);
        $payload = $draft ?? $this->buildDropshippingOrderDraft($batch);
        $check = $this->runDsFreightPrecheck($batch, $account, $payload);

        $this->persistBatchPayload($batch, [
            'ds_freight_check' => $check,
            'latest_request_payload_json' => $payload,
        ]);

        return $check;
    }

    public function createDropshippingOrder(ProcurementBatch $batch, array $data): array
    {
        $batch->loadMissing([
            'supplierAccount',
            'items.product',
            'items.productSupplierLink.supplierProductSku.supplierProduct.supplierAccount',
            'items.supplierProductSku.supplierProduct.supplierAccount',
        ]);

        $account = $this->resolveSupplierAccount($batch);
        $draft = $this->buildDropshippingOrderDraft($batch);
        $payload = [
            'ds_extend_request' => is_array($data['ds_extend_request'] ?? null)
                ? $data['ds_extend_request']
                : $draft['ds_extend_request'],
            'param_place_order_request4_open_api_d_t_o' => is_array($data['param_place_order_request4_open_api_d_t_o'] ?? null)
                ? $data['param_place_order_request4_open_api_d_t_o']
                : $draft['param_place_order_request4_open_api_d_t_o'],
        ];

        $this->validateDsCreatePayload($payload);

        $freightCheck = $this->runDsFreightPrecheck($batch, $account, $payload);
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

            $this->persistBatchPayload($batch, [
                'ds_freight_check' => $freightCheck,
                'ds_order_create' => array_merge($normalized, [
                    'created_at' => now()->toIso8601String(),
                ]),
                'latest_request_payload_json' => $payload,
                'latest_response_payload_json' => [
                    'freight_check' => $freightCheck,
                    'validation_error' => [
                        'message' => $freightFailureMessage,
                    ],
                ],
            ]);

            throw new \RuntimeException($freightFailureMessage);
        }

        $payload = $this->applyResolvedDsLogisticsServicesToPayload($payload, $freightCheck);

        try {
            $response = $this->supplierApiClient->iopOperation($account, 'ds-order-create', $payload);
        } catch (\RuntimeException $exception) {
            $this->throwDropshippingPermissionExceptionIfNeeded($account, $exception);

            throw $exception;
        }

        $normalized = $this->normalizeDsCreateResult($response);
        $externalOrderId = $normalized['order_list'][0] ?? $this->findFirstStringByKeys($response, ['order_id', 'orderId', 'trade_order_id', 'tradeOrderId']);

        $this->persistBatchPayload($batch, [
            'ds_freight_check' => $freightCheck,
            'ds_order_create' => array_merge($normalized, [
                'created_at' => now()->toIso8601String(),
            ]),
            'latest_request_payload_json' => $payload,
            'latest_response_payload_json' => $response,
        ]);

        if (! $normalized['success']) {
            throw new \RuntimeException($normalized['error_message'] ?: 'La creation de commande DS AliExpress groupée a echoue.');
        }

        $batch->forceFill([
            'supplier_order_reference' => $externalOrderId,
            'status' => 'submitted',
            'submitted_at' => now(),
        ])->save();

        return [
            'batch' => $batch->fresh(['supplierAccount', 'items.product', 'items.supplierProductSku.supplierProduct']),
            'result' => $normalized,
            'response' => $response,
        ];
    }

    private function resolveSupplierAccount(ProcurementBatch $batch): SupplierAccount
    {
        $account = $batch->supplierAccount;
        if (! $account && $batch->supplier_account_id) {
            $account = SupplierAccount::query()->find($batch->supplier_account_id);
        }

        if (! $account || (string) $account->platform !== 'aliexpress') {
            throw new \RuntimeException('Le lot groupé doit être rattaché à un compte AliExpress actif.');
        }

        return $account;
    }

    private function resolveSupplierReceivingAddress(ProcurementBatch $batch): SupplierReceivingAddress
    {
        foreach ($batch->items as $item) {
            foreach ($item->demandCoverages as $coverage) {
                $addressId = $coverage->procurementDemand?->order?->supplier_receiving_address_id;
                if ($addressId) {
                    $address = SupplierReceivingAddress::query()->find($addressId);
                    if ($address) {
                        return $address;
                    }
                }
            }
        }

        $address = SupplierReceivingAddress::query()
            ->where('platform', 'aliexpress')
            ->where('recipient_name', 'LAWSON-BODY')
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->first();

        if (! $address) {
            throw new \RuntimeException('Aucune adresse hub AliExpress active n est configuree pour la creation de commande DS groupée.');
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

    private function buildDsProductItems(ProcurementBatch $batch, SupplierAccount $account): array
    {
        if ($batch->items->isEmpty()) {
            throw new \RuntimeException('Le lot groupé ne contient aucun article à commander.');
        }

        $items = [];
        foreach ($batch->items as $batchItem) {
            $supplierSku = $batchItem->supplierProductSku ?: $batchItem->productSupplierLink?->supplierProductSku;
            $supplierProduct = $supplierSku?->supplierProduct;
            $productId = trim((string) ($supplierProduct?->external_product_id ?? ''));

            if ($productId === '') {
                throw new \RuntimeException('Le produit fournisseur AliExpress n a pas de product_id externe pour: ' . ($batchItem->product?->title ?? $batchItem->product?->name ?? ('#' . $batchItem->product_id)) . '.');
            }

            if ((int) ($supplierProduct?->supplier_account_id ?? 0) !== (int) $account->id) {
                throw new \RuntimeException('Tous les articles du lot groupé doivent pointer vers le même compte AliExpress.');
            }

            $items[] = array_filter([
                'product_id' => $productId,
                'sku_attr' => $supplierSku ? $this->resolveDsSkuAttr(
                    is_array($supplierSku->sku_payload_json) ? $supplierSku->sku_payload_json : [],
                    is_array($supplierSku->variant_attributes_json) ? $supplierSku->variant_attributes_json : []
                ) : null,
                'product_count' => (string) max(1, (int) ($batchItem->quantity_ordered ?? 1)),
                'logistics_service_name' => $this->resolveDsLogisticsServiceName($batchItem),
                'order_memo' => 'Lot groupe ' . ($batch->batch_number ?? ('batch-' . $batch->id)),
            ], static fn ($value) => $value !== null && $value !== '');
        }

        return $items;
    }

    private function resolveDsLogisticsServiceName(ProcurementBatchItem $batchItem): ?string
    {
        $link = $batchItem->productSupplierLink;
        $supplierSku = $batchItem->supplierProductSku ?: $link?->supplierProductSku;
        $supplierProduct = $supplierSku?->supplierProduct;

        $candidate = $this->nullableString(
            data_get($supplierSku?->sku_payload_json, 'logistics_service_name')
            ?? data_get($supplierSku?->sku_payload_json, 'service_name')
            ?? data_get($supplierSku?->sku_payload_json, 'serviceName')
            ?? data_get($link?->pricing_snapshot_json, 'logistics_service_name')
            ?? data_get($supplierProduct?->attributes_json, 'logistics_service_name')
            ?? data_get($supplierProduct?->product_payload_json, 'result.logistics_info_dto.logistics_service_name')
            ?? data_get($supplierProduct?->product_payload_json, 'result.logistics_info_dto.service_name')
            ?? data_get($supplierProduct?->product_payload_json, 'raw.result.logistics_info_dto.logistics_service_name')
            ?? data_get($supplierProduct?->product_payload_json, 'raw.result.logistics_info_dto.service_name')
            ?? $this->findFirstStringByKeys(is_array($supplierProduct?->product_payload_json) ? $supplierProduct->product_payload_json : [], ['logistics_service_name', 'service_name', 'serviceName', 'shipping_service_name', 'shippingServiceName'])
            ?? config('services.sourcing.platforms.aliexpress.ds_default_logistics_service_name')
        );

        return $this->canonicalizeDsLogisticsServiceName($candidate);
    }

    private function validateDsCreatePayload(array $payload): void
    {
        $request = is_array($payload['param_place_order_request4_open_api_d_t_o'] ?? null)
            ? $payload['param_place_order_request4_open_api_d_t_o']
            : [];
        $items = array_values(array_filter(
            is_array($request['product_items'] ?? null) ? $request['product_items'] : [],
            static fn ($item) => is_array($item)
        ));

        if ($items === []) {
            throw new \RuntimeException('Le draft DS du lot groupé ne contient aucun product_items exploitable.');
        }

        $issues = [];
        foreach ($items as $index => $item) {
            $productLabel = 'Ligne batch DS #' . ($index + 1);

            if ($this->nullableString($item['product_id'] ?? null) === null) {
                $issues[] = $productLabel . ': product_id manquant.';
            }

            if ($this->nullableString($item['logistics_service_name'] ?? null) === null) {
                $issues[] = $productLabel . ': logistics_service_name manquant.';
            }
        }

        $payCurrency = $this->nullableString(data_get($payload, 'ds_extend_request.payment.pay_currency'));
        if ($payCurrency !== null && strtoupper($payCurrency) !== 'USD') {
            $issues[] = 'La devise DS doit rester USD pour la creation de commande AliExpress.';
        }

        if ($issues !== []) {
            throw new \RuntimeException('Le draft DS du lot groupé est incomplet: ' . implode(' ', $issues));
        }
    }

    private function runDsFreightPrecheck(ProcurementBatch $batch, SupplierAccount $account, array $payload): array
    {
        $items = array_values(array_filter(
            is_array(data_get($payload, 'param_place_order_request4_open_api_d_t_o.product_items'))
                ? data_get($payload, 'param_place_order_request4_open_api_d_t_o.product_items')
                : [],
            static fn ($item) => is_array($item)
        ));

        $batchItems = $batch->items->values();
        $checks = [];
        foreach ($items as $index => $item) {
            $batchItem = $batchItems->get($index);
            $supplierSku = $batchItem?->supplierProductSku ?: $batchItem?->productSupplierLink?->supplierProductSku;
            $requestedService = $this->nullableString($item['logistics_service_name'] ?? null);
            $skuId = $this->resolveDsSelectedSkuId($supplierSku);
            $productId = $this->nullableString($item['product_id'] ?? null);
            $productLabel = $batchItem?->product?->title ?: $batchItem?->product?->name ?: ('Ligne batch DS #' . ($index + 1));

            $freightPayload = [
                'queryDeliveryReq' => array_filter([
                    'locale' => 'fr_FR',
                    'language' => $this->resolveLanguageFromLocale('fr_FR'),
                    'currency' => $this->nullableString(data_get($payload, 'ds_extend_request.payment.pay_currency')) ?: 'USD',
                    'shipToCountry' => self::DS_HUB_COUNTRY_CODE,
                    'productId' => $productId,
                    'selectedSkuId' => $skuId,
                    'quantity' => (int) ($item['product_count'] ?? 1) > 0 ? (int) $item['product_count'] : 1,
                ], static fn ($value) => $value !== null && $value !== ''),
            ];

            if ($productId === null || $skuId === null) {
                $checks[] = [
                    'product_name' => $productLabel,
                    'product_id' => $productId,
                    'sku_id' => $skuId,
                    'requested_logistics_service_name' => $requestedService,
                    'success' => false,
                    'error_message' => $productId === null
                        ? 'Precheck freight impossible: product_id manquant.'
                        : 'Precheck freight impossible: SKU DS sans selectedSkuId numerique.',
                    'available_services' => [],
                ];
                continue;
            }

            try {
                $response = $this->supplierApiClient->iopOperation($account, 'ds-freight-query', $freightPayload);
                $availableServices = $this->extractFreightServiceNames($response);
                $resolvedService = $this->resolveMatchingDsLogisticsServiceName($requestedService, $availableServices)
                    ?? ($requestedService === null ? $this->selectPreferredDsLogisticsServiceName($availableServices) : null);

                if ($batchItem?->productSupplierLink && $resolvedService !== null) {
                    $this->persistResolvedDsLogisticsServiceName($batchItem->productSupplierLink, $resolvedService);
                }

                $checks[] = [
                    'product_name' => $productLabel,
                    'product_id' => $productId,
                    'sku_id' => $skuId,
                    'requested_logistics_service_name' => $requestedService,
                    'resolved_logistics_service_name' => $resolvedService,
                    'available_services' => $availableServices,
                    'is_valid' => $requestedService === null ? ($resolvedService !== null ? true : null) : $resolvedService !== null,
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
            if (! is_array($item)) {
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
            if (! is_array($node)) {
                continue;
            }

            foreach ($node as $key => $value) {
                if (is_array($value)) {
                    $queue[] = $value;
                    continue;
                }

                if (! is_string($key)) {
                    continue;
                }

                $normalizedKey = strtolower($key);
                if (! in_array($normalizedKey, ['service_name', 'servicename', 'logistics_service_name', 'logisticsservicename', 'company', 'company_name'], true)) {
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

    private function canonicalizeDsLogisticsServiceName(?string $serviceName): ?string
    {
        $value = $this->nullableString($serviceName);
        if ($value === null) {
            return null;
        }

        $normalized = $this->normalizeDsLogisticsServiceName($value);

        return match ($normalized) {
            'aliexpress selection standard' => 'AliExpress Selection Standard',
            'aliexpress standard shipping', 'expedition standard aliexpress', 'aliexpress standard' => 'Expedition standard AliExpress',
            'aliexpress premium shipping', 'expedition premium aliexpress', 'aliexpress premium' => 'AliExpress Premium shipping',
            default => $value,
        };
    }

    private function resolveMatchingDsLogisticsServiceName(?string $requestedService, array $availableServices): ?string
    {
        $requested = $this->canonicalizeDsLogisticsServiceName($requestedService);
        if ($requested === null) {
            return null;
        }

        foreach ($availableServices as $availableService) {
            $available = $this->nullableString($availableService);
            if ($available !== null && strcasecmp($available, $requested) === 0) {
                return $available;
            }
        }

        $requestedAlias = $this->resolveDsLogisticsServiceAlias($requested);
        if ($requestedAlias === null) {
            return null;
        }

        foreach ($availableServices as $availableService) {
            $available = $this->nullableString($availableService);
            if ($available !== null && $this->resolveDsLogisticsServiceAlias($available) === $requestedAlias) {
                return $available;
            }
        }

        return null;
    }

    private function selectPreferredDsLogisticsServiceName(array $availableServices): ?string
    {
        $preferredNeedles = [
            'standard',
            'standard aliexpress',
            'premium',
        ];

        foreach ($preferredNeedles as $needle) {
            foreach ($availableServices as $availableService) {
                $available = $this->nullableString($availableService);
                if ($available !== null && str_contains($this->normalizeDsLogisticsServiceName($available), $needle)) {
                    return $available;
                }
            }
        }

        return $this->nullableString($availableServices[0] ?? null);
    }

    private function persistResolvedDsLogisticsServiceName(ProductSupplierLink $link, string $serviceName): void
    {
        $resolved = $this->nullableString($serviceName);
        if ($resolved === null) {
            return;
        }

        $snapshot = is_array($link->pricing_snapshot_json) ? $link->pricing_snapshot_json : [];
        if (($snapshot['logistics_service_name'] ?? null) !== $resolved) {
            $snapshot['logistics_service_name'] = $resolved;
            $link->forceFill(['pricing_snapshot_json' => $snapshot])->save();
        }

        $supplierSku = $link->supplierProductSku;
        if ($supplierSku) {
            $payload = is_array($supplierSku->sku_payload_json) ? $supplierSku->sku_payload_json : [];
            if (($payload['logistics_service_name'] ?? null) !== $resolved) {
                $payload['logistics_service_name'] = $resolved;
                $supplierSku->forceFill(['sku_payload_json' => $payload])->save();
            }
        }
    }

    private function applyResolvedDsLogisticsServicesToPayload(array $payload, array $freightCheck): array
    {
        $request = is_array($payload['param_place_order_request4_open_api_d_t_o'] ?? null)
            ? $payload['param_place_order_request4_open_api_d_t_o']
            : [];
        $items = array_values(array_filter(
            is_array($request['product_items'] ?? null) ? $request['product_items'] : [],
            static fn ($item) => is_array($item)
        ));

        foreach ($items as $index => $item) {
            $resolvedService = $this->nullableString(data_get($freightCheck, 'items.' . $index . '.resolved_logistics_service_name'));
            if ($resolvedService === null) {
                continue;
            }

            $items[$index]['logistics_service_name'] = $resolvedService;
        }

        $request['product_items'] = $items;
        $payload['param_place_order_request4_open_api_d_t_o'] = $request;

        return $payload;
    }

    private function resolveDsLogisticsServiceAlias(?string $serviceName): ?string
    {
        $value = $this->nullableString($serviceName);
        if ($value === null) {
            return null;
        }

        return match ($this->normalizeDsLogisticsServiceName($value)) {
            'aliexpress selection standard', 'aliexpress standard shipping', 'expedition standard aliexpress', 'aliexpress standard' => 'aliexpress-standard',
            'aliexpress premium shipping', 'expedition premium aliexpress', 'aliexpress premium' => 'aliexpress-premium',
            default => $this->normalizeDsLogisticsServiceName($value),
        };
    }

    private function normalizeDsLogisticsServiceName(string $value): string
    {
        $normalized = Str::lower(trim($value));
        $normalized = str_replace(['é', 'è', 'ê', 'ë', 'à', 'â', 'ä', 'î', 'ï', 'ô', 'ö', 'ù', 'û', 'ü'], ['e', 'e', 'e', 'e', 'a', 'a', 'a', 'i', 'i', 'o', 'o', 'u', 'u', 'u'], $normalized);
        $normalized = preg_replace('/[^a-z0-9]+/', ' ', $normalized) ?? '';

        return trim(preg_replace('/\s+/', ' ', $normalized) ?? '');
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
            'error_message' => $success
                ? null
                : $this->describeDsCreateError($errorCode, $remoteErrorMessage, $requestId),
        ];
    }

    private function describeDsCreateError(?string $errorCode, ?string $remoteMessage, ?string $requestId = null): string
    {
        $message = match ($errorCode) {
            'B_DROPSHIPPER_DELIVERY_ADDRESS_VALIDATE_FAIL' => 'Adresse fournisseur hub invalide pour AliExpress. Verifie le draft d adresse France.',
            'BLACKLIST_BUYER_IN_LIST', 'USER_ACCOUNT_DISABLED' => 'Le compte AliExpress connecte est invalide ou desactive. Essaie un autre compte fournisseur.',
            'PRICE_PAY_CURRENCY_ERROR' => 'Tous les articles de la commande DS doivent utiliser la meme devise de paiement.',
            'DELIVERY_METHOD_NOT_EXIST' => 'Le logistics_service_name est invalide. Lance d abord une verification freight puis corrige le draft.',
            'INVENTORY_HOLD_ERROR' => 'Stock insuffisant ou indisponible cote AliExpress.',
            'REPEATED_ORDER_ERROR' => 'Commande dupliquee detectee par AliExpress.',
            default => $remoteMessage ?: 'La creation de commande DS AliExpress groupée a echoue. Verifie logistics_service_name, sku_attr et le compte DS utilise.',
        };

        if ($requestId !== null && ! str_contains($message, 'request_id')) {
            $message .= ' request_id=' . $requestId;
        }

        return $message;
    }

    private function throwDropshippingPermissionExceptionIfNeeded(SupplierAccount $account, \RuntimeException $exception): void
    {
        $message = (string) $exception->getMessage();
        if (! str_contains($message, 'InsufficientPermission')) {
            return;
        }

        throw new \RuntimeException(
            'Le compte AliExpress "' . ($account->label ?? ('#' . $account->id)) . '" n a pas les permissions Dropshipping pour cette API. Active les scopes DS sur l application AliExpress, reconnecte le compte OAuth, puis relance la creation de commande DS.',
            previous: $exception,
        );
    }

    private function resolveDsSelectedSkuId(?SupplierProductSku $supplierSku): ?string
    {
        if (! $supplierSku) {
            return null;
        }

        $payload = is_array($supplierSku->sku_payload_json) ? $supplierSku->sku_payload_json : [];
        $candidates = [
            $supplierSku->external_sku_id,
            data_get($payload, 'selectedSkuId'),
            data_get($payload, 'selected_sku_id'),
            data_get($payload, 'sku_id'),
            data_get($payload, 'skuId'),
            $this->findFirstStringByKeys($payload, ['selectedSkuId', 'selected_sku_id', 'sku_id', 'skuId', 'sku_id_str', 'skuIdStr']),
            data_get($payload, 'id'),
        ];

        foreach ($candidates as $candidate) {
            $value = $this->nullableString($candidate);
            if ($value !== null && preg_match('/^\d+$/', $value) === 1) {
                return $value;
            }
        }

        return null;
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

        return $normalizedSegments !== [] ? implode(';', $normalizedSegments) : $direct;
    }

    private function buildDsOutOrderId(ProcurementBatch $batch): string
    {
        $reference = Str::slug((string) ($batch->batch_number ?? ('batch-' . $batch->id)), '-');

        return Str::limit('gp-batch-' . $batch->id . '-' . $reference, 64, '');
    }

    private function normalizeFrenchPhoneNumber(?string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $phone) ?? '';
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

    private function persistBatchPayload(ProcurementBatch $batch, array $updates): void
    {
        $payload = is_array($batch->supplier_order_payload_json) ? $batch->supplier_order_payload_json : [];
        foreach ($updates as $key => $value) {
            $payload[$key] = $value;
        }

        $batch->forceFill([
            'supplier_order_payload_json' => $payload,
        ])->save();
    }

    private function findFirstStringByKeys(array $payload, array $keys): ?string
    {
        $needle = array_flip(array_map(static fn ($key) => strtolower($key), $keys));
        $queue = [$payload];

        while ($queue !== []) {
            $node = array_shift($queue);
            if (! is_array($node)) {
                continue;
            }

            foreach ($node as $key => $value) {
                if (is_string($key) && isset($needle[strtolower($key)]) && ! is_array($value)) {
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
            if (! is_array($node)) {
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
            if (! is_array($node)) {
                continue;
            }

            foreach ($node as $key => $value) {
                if (is_string($key) && isset($needle[strtolower($key)]) && ! is_array($value)) {
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

    private function nullableString(mixed $value): ?string
    {
        if ($value === null || is_array($value)) {
            return null;
        }

        if (is_object($value) && ! method_exists($value, '__toString')) {
            return null;
        }

        $resolved = trim((string) $value);

        return $resolved === '' ? null : $resolved;
    }
}