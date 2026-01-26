<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'shipping_required')) {
                $table->boolean('shipping_required')->default(false)->after('stock_mode');
            }
            if (!Schema::hasColumn('products', 'delivery_type')) {
                $table->string('delivery_type', 16)->nullable()->after('shipping_required');
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'delivery_type')) {
                $table->dropColumn('delivery_type');
            }
            if (Schema::hasColumn('products', 'shipping_required')) {
                $table->dropColumn('shipping_required');
            }
        });
    }
};
