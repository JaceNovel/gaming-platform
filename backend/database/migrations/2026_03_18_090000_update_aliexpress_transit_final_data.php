<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        $countries = DB::table('supplier_countries')
            ->where('platform', 'aliexpress')
            ->whereIn('code', ['BF', 'BJ', 'TG'])
            ->pluck('id', 'code');

        $configs = [
            'BF' => [
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
                'customer_notice' => 'Burkina Faso: expedier d\'abord vers CHRIST SWS ZONGO a Guangzhou. Ajouter Talisa-Zongo999 sur chaque colis, imprimer le bon d\'entree du magasin et prevoir 60 RMB par colis a l\'entree du depot.',
            ],
            'BJ' => [
                'transit_provider_name' => 'Transit Benin Guangzhou',
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
                'customer_notice' => 'Benin: fret aerien 2 a 3 semaines, 8000 FCFA/kg en ordinaire et 9000 FCFA/kg avec batterie. Maritime a 250000 FCFA/CBM, minimum 0.05 CBM, delai 45 a 60 jours.',
            ],
            'TG' => [
                'transit_provider_name' => 'Transit Togo Guangzhou',
                'transit_city' => 'Guangzhou',
                'currency_code' => 'XOF',
                'pricing_rules_json' => [
                    'air' => [
                        'bands' => [
                            [
                                'min_weight_kg' => 0.0,
                                'max_weight_kg' => 0.5,
                                'ordinary_flat' => 4750,
                                'battery_flat' => 5250,
                            ],
                            [
                                'min_weight_kg' => 0.5,
                                'max_weight_kg' => 74.999,
                                'ordinary_per_kg' => 9500,
                                'battery_per_kg' => 10500,
                            ],
                            [
                                'min_weight_kg' => 75.0,
                                'max_weight_kg' => 79.999,
                                'ordinary_per_kg' => 9000,
                                'battery_per_kg' => 10500,
                            ],
                            [
                                'min_weight_kg' => 80.0,
                                'max_weight_kg' => 999999,
                                'ordinary_per_kg' => 9000,
                                'battery_per_kg' => 10000,
                            ],
                        ],
                    ],
                    'sea' => [
                        'per_cbm' => 180000,
                        'minimum_cbm' => 0.03,
                        'minimum_weight_kg' => 3,
                    ],
                ],
                'customer_notice' => 'Togo: chaque colis doit porter nom, prenom, WhatsApp et la mention Lome/TOGO. Fret aerien 15 a 18 jours. Maritime 180000 FCFA/CBM, minimum 0.03 CBM, aucun colis inferieur a 3 kg. Penalite de 500 FCFA/jour apres 5 jours, abandon apres 21 jours.',
            ],
        ];

        foreach ($configs as $code => $config) {
            if (! isset($countries[$code])) {
                continue;
            }

            DB::table('supplier_countries')
                ->where('id', $countries[$code])
                ->update([
                    'storefront_enabled' => true,
                    'is_active' => true,
                    'transit_provider_name' => $config['transit_provider_name'],
                    'transit_city' => $config['transit_city'],
                    'currency_code' => $config['currency_code'],
                    'pricing_rules_json' => json_encode($config['pricing_rules_json'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    'customer_notice' => $config['customer_notice'],
                    'updated_at' => $now,
                ]);
        }

        $addresses = [
            [
                'country_code' => 'BF',
                'recipient_name' => 'CHRIST SWS ZONGO',
                'contact_name' => 'Talisa',
                'address_line1' => '广州市越秀区环市西路202号富立国际大厦7楼704（桐舍酒店）',
                'address_line2' => '广州港华南国际物流有限公司（北区） 康柏仓库2楼W01仓',
                'city' => 'Guangzhou',
                'postal_code' => null,
                'phone' => '17820563584',
                'shipping_mark' => 'Talisa-Zongo999',
                'notes' => 'Contact depot: Talisa 13128658841. Imprimer le bon d\'entree avant depot. Frais d\'entree: 60 RMB par colis.',
                'is_default' => true,
            ],
            [
                'country_code' => 'BJ',
                'recipient_name' => 'Transit Benin Air',
                'contact_name' => 'Equipe Benin Air',
                'address_line1' => '广州市白云区黄石西路474号石井仓库三号仓十三号门(3-13)',
                'address_line2' => 'Fret aerien Benin',
                'city' => 'Guangzhou',
                'postal_code' => null,
                'phone' => '13760612978 / 15234022495',
                'shipping_mark' => 'BENIN-AIR',
                'notes' => 'Tarif aerien: 8000 FCFA/kg ordinaire, 9000 FCFA/kg batterie. Minimum 0.5 kg. Delai: 2 a 3 semaines.',
                'is_default' => true,
            ],
            [
                'country_code' => 'BJ',
                'recipient_name' => 'Transit Benin Sea',
                'contact_name' => 'Equipe Benin Sea',
                'address_line1' => '广州市白云区黄石西路474号石井仓库三号仓十三号门(3-13A)',
                'address_line2' => 'Fret maritime Benin',
                'city' => 'Guangzhou',
                'postal_code' => null,
                'phone' => '13760612978 / 15234022495',
                'shipping_mark' => 'BENIN-SEA',
                'notes' => 'Tarif maritime: 250000 FCFA/CBM. Minimum 0.05 CBM. Delai: 45 a 60 jours.',
                'is_default' => false,
            ],
        ];

        foreach ($addresses as $address) {
            $countryCode = $address['country_code'];
            if (! isset($countries[$countryCode])) {
                continue;
            }

            DB::table('supplier_receiving_addresses')->updateOrInsert(
                [
                    'supplier_country_id' => $countries[$countryCode],
                    'platform' => 'aliexpress',
                    'recipient_name' => $address['recipient_name'],
                ],
                [
                    'contact_name' => $address['contact_name'],
                    'address_line1' => $address['address_line1'],
                    'address_line2' => $address['address_line2'],
                    'city' => $address['city'],
                    'postal_code' => $address['postal_code'],
                    'phone' => $address['phone'],
                    'shipping_mark' => $address['shipping_mark'],
                    'notes' => $address['notes'],
                    'is_active' => true,
                    'is_default' => $address['is_default'],
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );
        }

        if (isset($countries['BJ'])) {
            DB::table('supplier_receiving_addresses')
                ->where('supplier_country_id', $countries['BJ'])
                ->where('platform', 'aliexpress')
                ->where('recipient_name', '!=', 'Transit Benin Air')
                ->update([
                    'is_default' => false,
                    'updated_at' => $now,
                ]);
        }

        if (isset($countries['BF'])) {
            DB::table('supplier_receiving_addresses')
                ->where('supplier_country_id', $countries['BF'])
                ->where('platform', 'aliexpress')
                ->where('recipient_name', '!=', 'CHRIST SWS ZONGO')
                ->update([
                    'is_default' => false,
                    'updated_at' => $now,
                ]);
        }
    }

    public function down(): void
    {
        $countries = DB::table('supplier_countries')
            ->where('platform', 'aliexpress')
            ->whereIn('code', ['BF', 'BJ', 'TG'])
            ->pluck('id', 'code');

        if ($countries->isEmpty()) {
            return;
        }

        DB::table('supplier_receiving_addresses')
            ->where('platform', 'aliexpress')
            ->whereIn('supplier_country_id', $countries->values())
            ->whereIn('recipient_name', ['CHRIST SWS ZONGO', 'Transit Benin Air', 'Transit Benin Sea'])
            ->delete();
    }
};