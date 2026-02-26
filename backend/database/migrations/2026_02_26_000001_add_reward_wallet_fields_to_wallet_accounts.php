<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wallet_accounts', function (Blueprint $table) {
            if (!Schema::hasColumn('wallet_accounts', 'reward_balance')) {
                $table->decimal('reward_balance', 16, 2)->default(0)->after('bonus_balance');
            }

            if (!Schema::hasColumn('wallet_accounts', 'reward_min_purchase_amount')) {
                $table->decimal('reward_min_purchase_amount', 16, 2)->nullable()->after('reward_balance');
            }
        });
    }

    public function down(): void
    {
        Schema::table('wallet_accounts', function (Blueprint $table) {
            if (Schema::hasColumn('wallet_accounts', 'reward_min_purchase_amount')) {
                $table->dropColumn('reward_min_purchase_amount');
            }

            if (Schema::hasColumn('wallet_accounts', 'reward_balance')) {
                $table->dropColumn('reward_balance');
            }
        });
    }
};
