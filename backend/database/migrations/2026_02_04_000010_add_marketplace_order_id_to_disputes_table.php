<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('disputes', function (Blueprint $table) {
            if (!Schema::hasColumn('disputes', 'marketplace_order_id')) {
                $table->foreignId('marketplace_order_id')->nullable()->after('id')
                    ->constrained('marketplace_orders')->nullOnDelete();

                $table->index(['marketplace_order_id']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('disputes', function (Blueprint $table) {
            if (Schema::hasColumn('disputes', 'marketplace_order_id')) {
                $table->dropConstrainedForeignId('marketplace_order_id');
            }
        });
    }
};
