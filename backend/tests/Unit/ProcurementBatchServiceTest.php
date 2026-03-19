<?php

namespace Tests\Unit;

use App\Models\Order;
use App\Models\ProcurementDemand;
use App\Models\Product;
use App\Models\SupplierAccount;
use App\Models\SupplierProduct;
use App\Models\ProductSupplierLink;
use App\Models\SupplierProductSku;
use App\Services\ProcurementBatchService;
use Illuminate\Support\Collection;
use PHPUnit\Framework\Attributes\Test;
use ReflectionMethod;
use RuntimeException;
use Tests\TestCase;

class ProcurementBatchServiceTest extends TestCase
{
    #[Test]
    public function it_rejects_demands_when_grouping_threshold_is_not_released(): void
    {
        $service = new ProcurementBatchService();

        $product = new Product([
            'id' => 1,
            'name' => 'Ensemble clavier et souris',
            'grouping_threshold' => 8,
        ]);
        $order = new Order([
            'supplier_fulfillment_status' => Order::SUPPLIER_STATUS_GROUPING,
        ]);
        $demand = new ProcurementDemand([
            'product_id' => 1,
            'quantity_to_procure' => 4,
        ]);
        $demand->setRelation('product', $product);
        $demand->setRelation('order', $order);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('seuil minimum de commande');

        $this->invokePrivate($service, 'ensureGroupingThresholdReleased', [new Collection([$demand])]);
    }

    #[Test]
    public function it_rejects_demands_when_supplier_moq_is_not_reached(): void
    {
        $service = new ProcurementBatchService();

        $product = new Product([
            'id' => 1,
            'name' => 'Casque gaming',
        ]);
        $link = new ProductSupplierLink([
            'product_id' => 1,
            'target_moq' => 8,
        ]);
        $sku = new SupplierProductSku([
            'moq' => 8,
        ]);

        $first = new ProcurementDemand([
            'product_id' => 1,
            'product_supplier_link_id' => 1,
            'supplier_product_sku_id' => 10,
            'quantity_to_procure' => 3,
        ]);
        $first->setRelation('product', $product);
        $first->setRelation('productSupplierLink', $link);
        $first->setRelation('supplierProductSku', $sku);

        $second = new ProcurementDemand([
            'product_id' => 1,
            'product_supplier_link_id' => 1,
            'supplier_product_sku_id' => 10,
            'quantity_to_procure' => 2,
        ]);
        $second->setRelation('product', $product);
        $second->setRelation('productSupplierLink', $link);
        $second->setRelation('supplierProductSku', $sku);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('MOQ fournisseur');

        $this->invokePrivate($service, 'ensureSupplierMoqReached', [new Collection([$first, $second])]);
    }

    #[Test]
    public function it_groups_only_released_demands_with_reached_moq_for_auto_batches(): void
    {
        $service = new ProcurementBatchService();

        $account = new SupplierAccount([
            'id' => 7,
            'platform' => 'aliexpress',
            'label' => 'Compte DS',
        ]);
        $supplierProduct = new SupplierProduct([
            'id' => 15,
            'title' => 'Clavier gaming',
        ]);
        $supplierProduct->setRelation('supplierAccount', $account);

        $sku = new SupplierProductSku([
            'id' => 10,
            'supplier_product_id' => 15,
            'moq' => 8,
            'currency_code' => 'USD',
            'sku_label' => 'Black RGB',
        ]);
        $sku->setRelation('supplierProduct', $supplierProduct);

        $product = new Product([
            'id' => 1,
            'name' => 'Clavier gaming',
            'grouping_threshold' => 8,
        ]);
        $link = new ProductSupplierLink([
            'id' => 21,
            'product_id' => 1,
            'supplier_product_sku_id' => 10,
            'target_moq' => 8,
            'warehouse_destination_label' => 'Hub France-Lome TG',
        ]);

        $releasedOrder = new Order([
            'id' => 100,
            'grouping_released_at' => now(),
            'supplier_country_code' => 'TG',
        ]);
        $blockedOrder = new Order([
            'id' => 101,
            'supplier_fulfillment_status' => Order::SUPPLIER_STATUS_GROUPING,
            'supplier_country_code' => 'TG',
        ]);

        $first = new ProcurementDemand([
            'product_id' => 1,
            'product_supplier_link_id' => 21,
            'supplier_product_sku_id' => 10,
            'quantity_to_procure' => 5,
        ]);
        $first->setAttribute('id', 1);
        $first->setRelation('product', $product);
        $first->setRelation('productSupplierLink', $link);
        $first->setRelation('supplierProductSku', $sku);
        $first->setRelation('order', $releasedOrder);

        $second = new ProcurementDemand([
            'product_id' => 1,
            'product_supplier_link_id' => 21,
            'supplier_product_sku_id' => 10,
            'quantity_to_procure' => 3,
        ]);
        $second->setAttribute('id', 2);
        $second->setRelation('product', $product);
        $second->setRelation('productSupplierLink', $link);
        $second->setRelation('supplierProductSku', $sku);
        $second->setRelation('order', $releasedOrder);

        $blocked = new ProcurementDemand([
            'product_id' => 1,
            'product_supplier_link_id' => 21,
            'supplier_product_sku_id' => 10,
            'quantity_to_procure' => 9,
        ]);
        $blocked->setAttribute('id', 3);
        $blocked->setRelation('product', $product);
        $blocked->setRelation('productSupplierLink', $link);
        $blocked->setRelation('supplierProductSku', $sku);
        $blocked->setRelation('order', $blockedOrder);

        $groups = $this->invokePrivate($service, 'buildAutoDraftDemandGroups', [new Collection([$first, $second, $blocked])]);

        $this->assertCount(1, $groups);
        $this->assertSame([1, 2], $groups[0]['demand_ids']);
        $this->assertSame([1], $groups[0]['product_ids']);
    }

    private function invokePrivate(object $instance, string $method, array $arguments): mixed
    {
        $reflection = new ReflectionMethod($instance, $method);
        $reflection->setAccessible(true);

        return $reflection->invokeArgs($instance, $arguments);
    }
}