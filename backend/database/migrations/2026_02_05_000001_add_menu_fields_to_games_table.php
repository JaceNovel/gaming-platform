<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('games', function (Blueprint $table) {
            if (!Schema::hasColumn('games', 'icon')) {
                $table->string('icon', 255)->nullable()->after('image');
            }
            if (!Schema::hasColumn('games', 'sort_order')) {
                $table->integer('sort_order')->default(0)->after('is_active');
            }
            if (!Schema::hasColumn('games', 'enabled_for_recharge')) {
                $table->boolean('enabled_for_recharge')->default(true)->after('sort_order');
            }
            if (!Schema::hasColumn('games', 'enabled_for_subscription')) {
                $table->boolean('enabled_for_subscription')->default(true)->after('enabled_for_recharge');
            }
            if (!Schema::hasColumn('games', 'enabled_for_marketplace')) {
                $table->boolean('enabled_for_marketplace')->default(true)->after('enabled_for_subscription');
            }
        });
    }

    public function down(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $drops = [];
            foreach (['icon', 'sort_order', 'enabled_for_recharge', 'enabled_for_subscription', 'enabled_for_marketplace'] as $col) {
                if (Schema::hasColumn('games', $col)) {
                    $drops[] = $col;
                }
            }
            if (!empty($drops)) {
                $table->dropColumn($drops);
            }
        });
    }
};
