<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $countryId = DB::table('supplier_countries')
            ->where('platform', 'aliexpress')
            ->where('code', 'TG')
            ->value('id');

        if (! $countryId) {
            return;
        }

        $now = now();

        $addresses = [
            [
                'recipient_name' => 'Transit Togo Air',
                'contact_name' => '易运国际',
                'address_line1' => '广州市白云区黄石西路474号石井仓库三号仓十三号门(3-13)',
                'address_line2' => '易运国际贝宁空运 Avion',
                'city' => 'Guangzhou',
                'postal_code' => null,
                'phone' => '13760612978 / 15234022495',
                'shipping_mark' => null,
                'notes' => 'Adresse Chine fournie pour le flux Togo en aerien.',
                'is_default' => true,
            ],
            [
                'recipient_name' => 'Transit Togo Sea',
                'contact_name' => '易运国际',
                'address_line1' => '广州市白云区黄石西路474号石井仓库三号仓十三B号门(3-13B)',
                'address_line2' => '易运国际贝宁海运 (Bateau)',
                'city' => 'Guangzhou',
                'postal_code' => null,
                'phone' => '13760612978 / 15234022495',
                'shipping_mark' => null,
                'notes' => 'Adresse Chine fournie pour le flux Togo en maritime.',
                'is_default' => false,
            ],
        ];

        foreach ($addresses as $address) {
            DB::table('supplier_receiving_addresses')->updateOrInsert(
                [
                    'supplier_country_id' => $countryId,
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

        DB::table('supplier_receiving_addresses')
            ->where('supplier_country_id', $countryId)
            ->where('platform', 'aliexpress')
            ->where('recipient_name', '!=', 'Transit Togo Air')
            ->update([
                'is_default' => false,
                'updated_at' => $now,
            ]);
    }

    public function down(): void
    {
        $countryId = DB::table('supplier_countries')
            ->where('platform', 'aliexpress')
            ->where('code', 'TG')
            ->value('id');

        if (! $countryId) {
            return;
        }

        DB::table('supplier_receiving_addresses')
            ->where('supplier_country_id', $countryId)
            ->where('platform', 'aliexpress')
            ->whereIn('recipient_name', ['Transit Togo Air', 'Transit Togo Sea'])
            ->delete();
    }
};