<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (!Schema::hasColumn('order_items', 'redeem_denomination_id')) {
                $table->foreignId('redeem_denomination_id')
                    ->nullable()
                    ->after('product_id')
                    ->constrained('redeem_denominations')
                    ->nullOnDelete();
            }

            if (!Schema::hasColumn('order_items', 'redeem_code_id')) {
                $table->foreignId('redeem_code_id')
                    ->nullable()
                    ->after('redeem_denomination_id')
                    ->constrained('redeem_codes')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (Schema::hasColumn('order_items', 'redeem_code_id')) {
                $table->dropConstrainedForeignId('redeem_code_id');
            }

            if (Schema::hasColumn('order_items', 'redeem_denomination_id')) {
                $table->dropConstrainedForeignId('redeem_denomination_id');
            }
        });
    }
};
