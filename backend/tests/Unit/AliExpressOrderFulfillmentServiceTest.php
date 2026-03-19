<?php

namespace Tests\Unit;

use App\Services\AliExpressOrderFulfillmentService;
use App\Services\SupplierApiClient;
use App\Services\SupplierCatalogImportService;
use PHPUnit\Framework\Attributes\Test;
use ReflectionMethod;
use Tests\TestCase;

class AliExpressOrderFulfillmentServiceTest extends TestCase
{
    #[Test]
    public function it_matches_standard_service_aliases_to_the_exact_available_service(): void
    {
        $service = $this->makeService();

        $resolved = $this->invokePrivate(
            $service,
            'resolveMatchingDsLogisticsServiceName',
            ['Expedition standard AliExpress', ['AliExpress Selection Standard']]
        );

        $this->assertSame('AliExpress Selection Standard', $resolved);
    }

    #[Test]
    public function it_rewrites_ds_payload_with_the_resolved_logistics_service_name(): void
    {
        $service = $this->makeService();

        $payload = [
            'param_place_order_request4_open_api_d_t_o' => [
                'product_items' => [
                    [
                        'product_id' => '123',
                        'logistics_service_name' => 'Expedition standard AliExpress',
                    ],
                ],
            ],
        ];

        $freightCheck = [
            'items' => [
                [
                    'resolved_logistics_service_name' => 'AliExpress Selection Standard',
                ],
            ],
        ];

        $resolvedPayload = $this->invokePrivate(
            $service,
            'applyResolvedDsLogisticsServicesToPayload',
            [$payload, $freightCheck]
        );

        $this->assertSame(
            'AliExpress Selection Standard',
            $resolvedPayload['param_place_order_request4_open_api_d_t_o']['product_items'][0]['logistics_service_name']
        );
    }

    private function makeService(): AliExpressOrderFulfillmentService
    {
        return new AliExpressOrderFulfillmentService(
            $this->createMock(SupplierApiClient::class),
            $this->createMock(SupplierCatalogImportService::class),
        );
    }

    private function invokePrivate(object $instance, string $method, array $arguments): mixed
    {
        $reflection = new ReflectionMethod($instance, $method);
        $reflection->setAccessible(true);

        return $reflection->invokeArgs($instance, $arguments);
    }
}