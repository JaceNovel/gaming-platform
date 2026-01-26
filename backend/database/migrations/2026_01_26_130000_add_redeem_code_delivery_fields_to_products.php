<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'redeem_code_delivery')) {
                $table->boolean('redeem_code_delivery')->default(false)->after('stock_mode');
            }
            if (!Schema::hasColumn('products', 'stock_low_threshold')) {
                $table->integer('stock_low_threshold')->default(10)->after('redeem_code_delivery');
            }
            if (!Schema::hasColumn('products', 'stock_alert_channel')) {
                $table->string('stock_alert_channel', 20)->nullable()->after('stock_low_threshold');
            }
            if (!Schema::hasColumn('products', 'stock_alert_emails')) {
                $table->text('stock_alert_emails')->nullable()->after('stock_alert_channel');
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'redeem_code_delivery')) {
                $table->dropColumn('redeem_code_delivery');
            }
            if (Schema::hasColumn('products', 'stock_low_threshold')) {
                $table->dropColumn('stock_low_threshold');
            }
            if (Schema::hasColumn('products', 'stock_alert_channel')) {
                $table->dropColumn('stock_alert_channel');
            }
            if (Schema::hasColumn('products', 'stock_alert_emails')) {
                $table->dropColumn('stock_alert_emails');
            }
        });
    }
};
