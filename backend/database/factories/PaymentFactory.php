<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Payment>
 */
class PaymentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'order_id' => \App\Models\Order::factory(),
            'amount' => $this->faker->numberBetween(1000, 50000),
            'method' => 'cinetpay',
            'status' => 'pending',
            'transaction_id' => 'TXN-' . $this->faker->unique()->numberBetween(100000, 999999),
            'webhook_data' => null,
        ];
    }
}
