<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'user_id')) {
                $table->foreignId('user_id')->nullable()->constrained()->onDelete('set null');
            }
            if (!Schema::hasColumn('orders', 'status')) {
                $table->string('status', 32)->default('pending');
            }
            if (!Schema::hasColumn('orders', 'total_price')) {
                $table->decimal('total_price', 10, 2)->default(0);
            }
            if (!Schema::hasColumn('orders', 'items')) {
                $table->json('items')->nullable();
            }
            if (!Schema::hasColumn('orders', 'reference')) {
                $table->string('reference')->nullable()->unique();
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'user_id')) {
                $table->dropForeign(['user_id']);
                $table->dropColumn('user_id');
            }
            if (Schema::hasColumn('orders', 'status')) {
                $table->dropColumn('status');
            }
            if (Schema::hasColumn('orders', 'total_price')) {
                $table->dropColumn('total_price');
            }
            if (Schema::hasColumn('orders', 'items')) {
                $table->dropColumn('items');
            }
            if (Schema::hasColumn('orders', 'reference')) {
                $table->dropColumn('reference');
            }
        });
    }
};
