<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'type')) {
                $table->string('type', 32)->default('purchase')->after('user_id');
            }
            if (!Schema::hasColumn('orders', 'meta')) {
                $table->json('meta')->nullable()->after('items');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'type')) {
                $table->dropColumn('type');
            }
            if (Schema::hasColumn('orders', 'meta')) {
                $table->dropColumn('meta');
            }
        });
    }
};
