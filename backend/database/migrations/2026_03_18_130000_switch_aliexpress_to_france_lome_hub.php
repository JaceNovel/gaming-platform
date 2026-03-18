<?php

use App\Models\Order;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        $serviceCountries = [
            'CI' => [
                'name' => "Cote d'Ivoire",
                'sort_order' => 0,
                'shipping_mark' => 'CI-LOME',
            ],
            'BJ' => [
                'name' => 'Benin',
                'sort_order' => 1,
                'shipping_mark' => 'BJ-LOME',
            ],
            'GH' => [
                'name' => 'Ghana',
                'sort_order' => 2,
                'shipping_mark' => 'GH-LOME',
            ],
            'TG' => [
                'name' => 'Togo',
                'sort_order' => 3,
                'shipping_mark' => 'TG-LOME',
            ],
        ];

        $hubNotice = "Votre commande est acheminee vers notre hub logistique central, puis preparee pour la livraison locale par voie routiere. Votre tracking number sera communique des l'expedition.";

        $countryIds = DB::table('supplier_countries')
            ->where('platform', 'aliexpress')
            ->whereIn('code', array_merge(array_keys($serviceCountries), ['BF', 'FR']))
            ->pluck('id', 'code');

        foreach ($serviceCountries as $code => $config) {
            if (! isset($countryIds[$code])) {
                continue;
            }

            DB::table('supplier_countries')
                ->where('id', $countryIds[$code])
                ->update([
                    'is_active' => true,
                    'storefront_enabled' => true,
                    'sort_order' => $config['sort_order'],
                    'transit_provider_name' => 'Hub France-Lome',
                    'transit_city' => 'Maisons-Laffitte',
                    'currency_code' => 'XOF',
                    'pricing_rules_json' => json_encode([
                        'hub_delivery' => true,
                    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    'customer_notice' => $hubNotice,
                    'updated_at' => $now,
                ]);

            DB::table('supplier_receiving_addresses')->updateOrInsert(
                [
                    'supplier_country_id' => $countryIds[$code],
                    'platform' => 'aliexpress',
                    'recipient_name' => 'LAWSON-BODY',
                ],
                [
                    'contact_name' => 'ANOKO EMEFA for Lemouel',
                    'address_line1' => '42 RUE DE PARIS',
                    'address_line2' => 'CENTRE MBE 2538',
                    'city' => 'MAISONS-LAFFITTE',
                    'postal_code' => '78600',
                    'phone' => '0666942189',
                    'shipping_mark' => $config['shipping_mark'],
                    'notes' => 'Hub logistique principal France-Lome. Reception de tous les colis AliExpress puis preparation pour la livraison locale par voie routiere vers ' . $config['name'] . '.',
                    'is_active' => true,
                    'is_default' => true,
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );

            DB::table('supplier_receiving_addresses')
                ->where('supplier_country_id', $countryIds[$code])
                ->where('platform', 'aliexpress')
                ->where('recipient_name', '!=', 'LAWSON-BODY')
                ->update([
                    'is_active' => false,
                    'is_default' => false,
                    'updated_at' => $now,
                ]);
        }

        DB::table('supplier_countries')
            ->where('platform', 'aliexpress')
            ->whereIn('code', ['BF', 'FR'])
            ->update([
                'storefront_enabled' => false,
                'updated_at' => $now,
            ]);

        $addressIdsByCountry = DB::table('supplier_receiving_addresses')
            ->join('supplier_countries', 'supplier_countries.id', '=', 'supplier_receiving_addresses.supplier_country_id')
            ->where('supplier_receiving_addresses.platform', 'aliexpress')
            ->where('supplier_receiving_addresses.recipient_name', 'LAWSON-BODY')
            ->whereIn('supplier_countries.code', array_keys($serviceCountries))
            ->pluck('supplier_receiving_addresses.id', 'supplier_countries.code');

        foreach ($serviceCountries as $code => $config) {
            $addressId = $addressIdsByCountry[$code] ?? null;
            if (! $addressId) {
                continue;
            }

            DB::table('orders')
                ->where('supplier_platform', 'aliexpress')
                ->where('supplier_country_code', $code)
                ->whereIn('supplier_fulfillment_status', [
                    Order::SUPPLIER_STATUS_PENDING,
                    Order::SUPPLIER_STATUS_PAID,
                    Order::SUPPLIER_STATUS_GROUPING,
                    Order::SUPPLIER_STATUS_SUPPLIER_ORDERED,
                    Order::SUPPLIER_STATUS_WAREHOUSE_RECEIVED,
                    Order::SUPPLIER_STATUS_DELIVERING,
                ])
                ->update([
                    'supplier_receiving_address_id' => $addressId,
                    'shipping_mark_pdf_path' => null,
                    'transit_pricing_snapshot_json' => json_encode([
                        'country_code' => $code,
                        'country_name' => $config['name'],
                        'transit_provider_name' => 'Hub France-Lome',
                        'transit_city' => 'Maisons-Laffitte',
                        'customer_notice' => $hubNotice,
                        'direct_delivery' => false,
                    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ]);
        }
    }

    public function down(): void
    {
        $now = now();

        DB::table('supplier_countries')
            ->where('platform', 'aliexpress')
            ->whereIn('code', ['CI', 'BJ', 'GH', 'TG'])
            ->update([
                'customer_notice' => "⚠️ Expedition apres atteinte du seuil minimum de commande pour votre zone. Votre tracking number sera communique des l'expedition.",
                'updated_at' => $now,
            ]);

        DB::table('supplier_countries')
            ->where('platform', 'aliexpress')
            ->where('code', 'FR')
            ->update([
                'storefront_enabled' => true,
                'updated_at' => $now,
            ]);
    }
};