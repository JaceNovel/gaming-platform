<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        $existing = DB::table('supplier_countries')
            ->where('platform', 'aliexpress')
            ->where('code', 'FR')
            ->first();

        $payload = [
            'platform' => 'aliexpress',
            'code' => 'FR',
            'name' => 'France',
            'is_active' => true,
            'storefront_enabled' => true,
            'transit_provider_name' => null,
            'transit_city' => null,
            'currency_code' => 'EUR',
            'pricing_rules_json' => json_encode([
                'direct_delivery' => true,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'customer_notice' => "Livraison directe en France a l'adresse exacte saisie lors de la commande. Votre tracking number sera communique des l'expedition.",
            'sort_order' => 999,
            'updated_at' => $now,
        ];

        if ($existing) {
            DB::table('supplier_countries')
                ->where('id', $existing->id)
                ->update($payload);

            return;
        }

        DB::table('supplier_countries')->insert(array_merge($payload, [
            'created_at' => $now,
        ]));
    }

    public function down(): void
    {
        DB::table('supplier_countries')
            ->where('platform', 'aliexpress')
            ->where('code', 'FR')
            ->delete();
    }
};