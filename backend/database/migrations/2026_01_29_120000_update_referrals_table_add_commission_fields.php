<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('referrals', function (Blueprint $table) {
            if (!Schema::hasColumn('referrals', 'commission_rate')) {
                $table->decimal('commission_rate', 5, 4)->nullable()->after('commission_earned');
            }
            if (!Schema::hasColumn('referrals', 'commission_base_amount')) {
                $table->decimal('commission_base_amount', 10, 2)->nullable()->after('commission_rate');
            }
            if (!Schema::hasColumn('referrals', 'rewarded_at')) {
                $table->timestamp('rewarded_at')->nullable()->after('commission_base_amount');
            }

            // One user can only be referred once.
            $table->unique('referred_id');
        });
    }

    public function down(): void
    {
        Schema::table('referrals', function (Blueprint $table) {
            $table->dropUnique(['referred_id']);
            if (Schema::hasColumn('referrals', 'rewarded_at')) {
                $table->dropColumn('rewarded_at');
            }
            if (Schema::hasColumn('referrals', 'commission_base_amount')) {
                $table->dropColumn('commission_base_amount');
            }
            if (Schema::hasColumn('referrals', 'commission_rate')) {
                $table->dropColumn('commission_rate');
            }
        });
    }
};
