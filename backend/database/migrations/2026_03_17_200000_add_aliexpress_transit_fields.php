<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('supplier_countries', function (Blueprint $table) {
            if (!Schema::hasColumn('supplier_countries', 'storefront_enabled')) {
                $table->boolean('storefront_enabled')->default(false)->after('is_active');
            }
            if (!Schema::hasColumn('supplier_countries', 'transit_provider_name')) {
                $table->string('transit_provider_name', 160)->nullable()->after('storefront_enabled');
            }
            if (!Schema::hasColumn('supplier_countries', 'transit_city')) {
                $table->string('transit_city', 120)->nullable()->after('transit_provider_name');
            }
            if (!Schema::hasColumn('supplier_countries', 'currency_code')) {
                $table->string('currency_code', 8)->default('XOF')->after('transit_city');
            }
            if (!Schema::hasColumn('supplier_countries', 'pricing_rules_json')) {
                $table->json('pricing_rules_json')->nullable()->after('currency_code');
            }
            if (!Schema::hasColumn('supplier_countries', 'customer_notice')) {
                $table->text('customer_notice')->nullable()->after('pricing_rules_json');
            }
        });

        Schema::table('supplier_receiving_addresses', function (Blueprint $table) {
            if (!Schema::hasColumn('supplier_receiving_addresses', 'contact_name')) {
                $table->string('contact_name', 160)->nullable()->after('recipient_name');
            }
            if (!Schema::hasColumn('supplier_receiving_addresses', 'notes')) {
                $table->text('notes')->nullable()->after('shipping_mark');
            }
        });

        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'estimated_weight_grams')) {
                $table->unsignedInteger('estimated_weight_grams')->nullable()->after('supplier_shipping_fee');
            }
            if (!Schema::hasColumn('products', 'estimated_cbm')) {
                $table->decimal('estimated_cbm', 10, 4)->nullable()->after('estimated_weight_grams');
            }
            if (!Schema::hasColumn('products', 'source_logistics_profile')) {
                $table->string('source_logistics_profile', 24)->default('ordinary')->after('estimated_cbm');
            }
            if (!Schema::hasColumn('products', 'country_availability_json')) {
                $table->json('country_availability_json')->nullable()->after('source_logistics_profile');
            }
        });

        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'shipping_mark_pdf_path')) {
                $table->string('shipping_mark_pdf_path')->nullable()->after('shipping_document_path');
            }
            if (!Schema::hasColumn('orders', 'transit_pricing_snapshot_json')) {
                $table->json('transit_pricing_snapshot_json')->nullable()->after('shipping_mark_pdf_path');
            }
        });

        $now = now();

        $configs = [
            'BF' => [
                'storefront_enabled' => true,
                'transit_provider_name' => 'CHRIST SWS ZONGO',
                'transit_city' => 'Guangzhou',
                'currency_code' => 'XOF',
                'pricing_rules_json' => [
                    'air' => [
                        'minimum_weight_kg' => 0.0,
                        'ordinary_per_kg' => 10000,
                        'battery_per_kg' => 13500,
                    ],
                    'sea' => [
                        'per_cbm' => 250000,
                        'minimum_cbm' => 0.1,
                        'overweight_surcharge_per_kg' => 300,
                    ],
                ],
                'customer_notice' => 'Votre commande est d\'abord livree a notre transitaire en Chine, puis groupee avant expedition vers le Burkina Faso.',
            ],
            'BJ' => [
                'storefront_enabled' => true,
                'transit_provider_name' => 'Transitaire Benin',
                'transit_city' => 'Guangzhou',
                'currency_code' => 'XOF',
                'pricing_rules_json' => [
                    'air' => [
                        'minimum_weight_kg' => 0.5,
                        'ordinary_per_kg' => 8000,
                        'battery_per_kg' => 9000,
                    ],
                    'sea' => [
                        'per_cbm' => 250000,
                        'minimum_cbm' => 0.05,
                    ],
                ],
                'customer_notice' => 'Votre commande est livree en Chine chez notre transitaire, puis groupee avant expedition vers le Benin.',
            ],
            'TG' => [
                'storefront_enabled' => true,
                'transit_provider_name' => 'Transitaire Togo',
                'transit_city' => 'Guangzhou',
                'currency_code' => 'XOF',
                'pricing_rules_json' => [
                    'air' => [
                        'bands' => [
                            ['max_weight_kg' => 0.5, 'ordinary_flat' => 4750, 'battery_flat' => 5250],
                            ['max_weight_kg' => 20.0, 'ordinary_per_kg' => 9500, 'battery_per_kg' => 10500],
                        ],
                    ],
                    'sea' => [
                        'per_cbm' => 180000,
                        'minimum_cbm' => 0.03,
                        'minimum_weight_kg' => 3,
                    ],
                ],
                'customer_notice' => 'Votre commande est livree en Chine chez notre transitaire, puis expediee vers le Togo apres groupage.',
            ],
        ];

        foreach ($configs as $code => $config) {
            DB::table('supplier_countries')
                ->where('platform', 'aliexpress')
                ->where('code', $code)
                ->update(array_merge($config, ['updated_at' => $now]));
        }

        DB::table('supplier_countries')
            ->where('platform', 'aliexpress')
            ->whereNotIn('code', array_keys($configs))
            ->update([
                'is_active' => false,
                'storefront_enabled' => false,
                'updated_at' => $now,
            ]);
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            foreach (['transit_pricing_snapshot_json', 'shipping_mark_pdf_path'] as $column) {
                if (Schema::hasColumn('orders', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('products', function (Blueprint $table) {
            foreach (['country_availability_json', 'source_logistics_profile', 'estimated_cbm', 'estimated_weight_grams'] as $column) {
                if (Schema::hasColumn('products', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('supplier_receiving_addresses', function (Blueprint $table) {
            foreach (['notes', 'contact_name'] as $column) {
                if (Schema::hasColumn('supplier_receiving_addresses', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('supplier_countries', function (Blueprint $table) {
            foreach (['customer_notice', 'pricing_rules_json', 'currency_code', 'transit_city', 'transit_provider_name', 'storefront_enabled'] as $column) {
                if (Schema::hasColumn('supplier_countries', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};