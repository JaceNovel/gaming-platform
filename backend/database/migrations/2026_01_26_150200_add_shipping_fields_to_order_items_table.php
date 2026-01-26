<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (!Schema::hasColumn('order_items', 'is_physical')) {
                $table->boolean('is_physical')->default(false)->after('redeem_code_id');
            }
            if (!Schema::hasColumn('order_items', 'delivery_type')) {
                $table->string('delivery_type', 16)->nullable()->after('is_physical');
            }
            if (!Schema::hasColumn('order_items', 'delivery_eta_days')) {
                $table->integer('delivery_eta_days')->nullable()->after('delivery_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (Schema::hasColumn('order_items', 'delivery_eta_days')) {
                $table->dropColumn('delivery_eta_days');
            }
            if (Schema::hasColumn('order_items', 'delivery_type')) {
                $table->dropColumn('delivery_type');
            }
            if (Schema::hasColumn('order_items', 'is_physical')) {
                $table->dropColumn('is_physical');
            }
        });
    }
};
