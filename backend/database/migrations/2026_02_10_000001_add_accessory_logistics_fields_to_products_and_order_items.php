<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'accessory_category')) {
                $table->string('accessory_category', 32)->nullable()->after('category');
            }
            if (!Schema::hasColumn('products', 'accessory_subcategory')) {
                $table->string('accessory_subcategory', 64)->nullable()->after('accessory_category');
            }
            if (!Schema::hasColumn('products', 'accessory_stock_mode')) {
                // local | air | sea
                $table->string('accessory_stock_mode', 16)->nullable()->after('stock_type');
            }
            if (!Schema::hasColumn('products', 'shipping_fee')) {
                $table->decimal('shipping_fee', 16, 2)->default(0)->after('price');
            }
        });

        Schema::table('order_items', function (Blueprint $table) {
            if (!Schema::hasColumn('order_items', 'shipping_fee')) {
                $table->decimal('shipping_fee', 16, 2)->default(0)->after('price');
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'shipping_fee')) {
                $table->dropColumn('shipping_fee');
            }
            if (Schema::hasColumn('products', 'accessory_stock_mode')) {
                $table->dropColumn('accessory_stock_mode');
            }
            if (Schema::hasColumn('products', 'accessory_subcategory')) {
                $table->dropColumn('accessory_subcategory');
            }
            if (Schema::hasColumn('products', 'accessory_category')) {
                $table->dropColumn('accessory_category');
            }
        });

        Schema::table('order_items', function (Blueprint $table) {
            if (Schema::hasColumn('order_items', 'shipping_fee')) {
                $table->dropColumn('shipping_fee');
            }
        });
    }
};
