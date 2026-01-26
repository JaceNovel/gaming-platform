<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Product>
 */
class ProductFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'game_id' => \App\Models\Game::factory(),
            'name' => $this->faker->words(3, true),
            'type' => $this->faker->randomElement(['account', 'recharge', 'item']),
            'price' => $this->faker->numberBetween(1000, 50000),
            'discount_price' => null,
            'stock' => $this->faker->numberBetween(0, 100),
            'is_active' => true,
            'details' => [],
            'shipping_required' => false,
            'delivery_type' => null,
        ];
    }
}
