<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'price_fcfa')) {
                $table->unsignedBigInteger('price_fcfa')->nullable()->after('price');
            }

            if (!Schema::hasColumn('products', 'stock_mode')) {
                $table->string('stock_mode', 32)->default('manual')->after('stock_type');
            }

            if (!Schema::hasColumn('products', 'redeem_sku')) {
                $table->string('redeem_sku', 64)->nullable()->after('sku');
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'price_fcfa')) {
                $table->dropColumn('price_fcfa');
            }

            if (Schema::hasColumn('products', 'stock_mode')) {
                $table->dropColumn('stock_mode');
            }

            if (Schema::hasColumn('products', 'redeem_sku')) {
                $table->dropColumn('redeem_sku');
            }
        });
    }
};
