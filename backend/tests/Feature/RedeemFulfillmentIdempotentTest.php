<?php

namespace Tests\Feature;

use App\Jobs\ProcessRedeemFulfillment;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\RedeemCode;
use App\Models\RedeemDenomination;
use App\Models\User;
use App\Services\RedeemCodeAllocator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Test;

class RedeemFulfillmentIdempotentTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function redeem_fulfillment_is_idempotent(): void
    {
        Mail::fake();

        $user = User::factory()->create();
        $product = Product::factory()->create([
            'type' => 'redeem',
            'price' => 5000,
        ]);

        $denomination = RedeemDenomination::create([
            'product_id' => $product->id,
            'code' => '110D',
            'label' => 'Free Fire 110D',
            'diamonds' => 110,
            'active' => true,
        ]);

        $codeA = RedeemCode::create([
            'denomination_id' => $denomination->id,
            'code' => 'CODE-AAA-111',
            'status' => 'available',
        ]);
        $codeB = RedeemCode::create([
            'denomination_id' => $denomination->id,
            'code' => 'CODE-BBB-222',
            'status' => 'available',
        ]);

        $order = Order::create([
            'user_id' => $user->id,
            'type' => 'redeem',
            'status' => 'paid',
            'total_price' => 5000,
        ]);

        $item = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'redeem_denomination_id' => $denomination->id,
            'quantity' => 1,
            'price' => 5000,
            'delivery_status' => 'pending',
        ]);

        $job = new ProcessRedeemFulfillment($order->id);
        $job->handle(app(RedeemCodeAllocator::class));

        $item->refresh();
        $this->assertNotNull($item->redeem_code_id);

        $assignedCodeId = $item->redeem_code_id;

        $job->handle(app(RedeemCodeAllocator::class));

        $item->refresh();
        $this->assertEquals($assignedCodeId, $item->redeem_code_id);

        $this->assertEquals('sent', RedeemCode::find($assignedCodeId)->status);
        $this->assertEquals('available', RedeemCode::where('id', $codeB->id)->value('status'));
    }
}
