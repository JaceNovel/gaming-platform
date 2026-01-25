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
                DB::statement(<<<'SQL'
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_product_id_foreign') THEN
        ALTER TABLE orders DROP CONSTRAINT orders_product_id_foreign;
    END IF;
END $$;
SQL);
            }

            Schema::table('orders', function (Blueprint $table) {
                $table->dropForeign(['product_id']);
            });
        }

        $columnsToDrop = array_filter(
            ['product_id', 'quantity', 'game_user_id'],
            fn ($column) => Schema::hasColumn('orders', $column)
        );

        Schema::table('orders', function (Blueprint $table) use ($columnsToDrop) {
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
        $missingProductId = !Schema::hasColumn('orders', 'product_id');
        $missingQuantity = !Schema::hasColumn('orders', 'quantity');
        $missingGameUserId = !Schema::hasColumn('orders', 'game_user_id');
        $hasItems = Schema::hasColumn('orders', 'items');

        Schema::table('orders', function (Blueprint $table) use (
            $missingProductId,
            $missingQuantity,
            $missingGameUserId,
            $hasItems
        ) {
            if ($missingProductId) {
                $table->foreignId('product_id');
            }

            if ($missingQuantity) {
                $table->integer('quantity')->default(1);
            }

            if ($missingGameUserId) {
                $table->json('game_user_id')->nullable();
            }

            if ($hasItems) {
                $table->dropColumn('items');
            }
        });

        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'product_id')) {
                $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            }
        });
    }
};
