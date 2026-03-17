<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supplier_countries', function (Blueprint $table) {
            $table->id();
            $table->string('platform', 32);
            $table->string('code', 2);
            $table->string('name', 120);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['platform', 'code']);
            $table->index(['platform', 'is_active']);
        });

        Schema::create('supplier_receiving_addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('supplier_country_id')->constrained('supplier_countries')->cascadeOnDelete();
            $table->string('platform', 32);
            $table->string('recipient_name');
            $table->string('address_line1');
            $table->string('address_line2')->nullable();
            $table->string('city', 120);
            $table->string('postal_code', 32)->nullable();
            $table->string('phone', 64);
            $table->string('shipping_mark')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->index(['platform', 'supplier_country_id']);
            $table->index(['platform', 'is_active']);
        });

        $countries = [
            ['code' => 'TG', 'name' => 'Togo'],
            ['code' => 'BJ', 'name' => 'Benin'],
            ['code' => 'CI', 'name' => "Cote d'Ivoire"],
            ['code' => 'GH', 'name' => 'Ghana'],
            ['code' => 'NG', 'name' => 'Nigeria'],
            ['code' => 'CG', 'name' => 'Congo'],
            ['code' => 'BF', 'name' => 'Burkina Faso'],
        ];

        $rows = [];
        foreach (['alibaba', 'aliexpress'] as $platformIndex => $platform) {
            foreach ($countries as $countryIndex => $country) {
                $rows[] = [
                    'platform' => $platform,
                    'code' => $country['code'],
                    'name' => $country['name'],
                    'is_active' => true,
                    'sort_order' => ($platformIndex * 100) + $countryIndex,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }

        DB::table('supplier_countries')->insert($rows);
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_receiving_addresses');
        Schema::dropIfExists('supplier_countries');
    }
};