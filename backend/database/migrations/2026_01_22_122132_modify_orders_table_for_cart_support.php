<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if (Schema::hasColumn('orders', 'product_id')) {
            if ($driver === 'pgsql') {
                DB::statement('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_product_id_foreign');
            } else {
                Schema::table('orders', function (Blueprint $table) {
                    $table->dropForeign(['product_id']);
                });
            }
        }

        Schema::table('orders', function (Blueprint $table) {
            $columnsToDrop = array_filter(
                ['product_id', 'quantity', 'game_user_id'],
                fn ($column) => Schema::hasColumn('orders', $column)
            );

            if (!empty($columnsToDrop)) {
                $table->dropColumn($columnsToDrop);
            }

            if (!Schema::hasColumn('orders', 'items')) {
                $table->json('items')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('product_id')->constrained()->onDelete('cascade');
            $table->integer('quantity')->default(1);
            $table->json('game_user_id')->nullable();
            $table->dropColumn('items');
        });
    }
};
