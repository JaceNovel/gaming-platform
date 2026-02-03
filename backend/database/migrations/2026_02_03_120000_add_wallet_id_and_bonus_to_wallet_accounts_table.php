<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wallet_accounts', function (Blueprint $table) {
            if (!Schema::hasColumn('wallet_accounts', 'wallet_id')) {
                $table->string('wallet_id', 64)->nullable()->unique()->after('id');
            }
            if (!Schema::hasColumn('wallet_accounts', 'bonus_balance')) {
                $table->decimal('bonus_balance', 16, 2)->default(0)->after('balance');
            }
            if (!Schema::hasColumn('wallet_accounts', 'bonus_expires_at')) {
                $table->timestamp('bonus_expires_at')->nullable()->after('bonus_balance');
            }
            if (!Schema::hasColumn('wallet_accounts', 'recharge_blocked_at')) {
                $table->timestamp('recharge_blocked_at')->nullable()->after('status');
                $table->index(['recharge_blocked_at']);
            }
            if (!Schema::hasColumn('wallet_accounts', 'recharge_blocked_reason')) {
                $table->string('recharge_blocked_reason', 255)->nullable()->after('recharge_blocked_at');
            }
        });

        // Backfill wallet_id for existing wallets.
        DB::table('wallet_accounts')
            ->whereNull('wallet_id')
            ->orderBy('id')
            ->chunkById(200, function ($rows) {
                foreach ($rows as $row) {
                    DB::table('wallet_accounts')
                        ->where('id', $row->id)
                        ->update(['wallet_id' => 'DBW-' . (string) Str::ulid()]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('wallet_accounts', function (Blueprint $table) {
            if (Schema::hasColumn('wallet_accounts', 'wallet_id')) {
                $table->dropUnique(['wallet_id']);
                $table->dropColumn('wallet_id');
            }
            if (Schema::hasColumn('wallet_accounts', 'bonus_balance')) {
                $table->dropColumn('bonus_balance');
            }
            if (Schema::hasColumn('wallet_accounts', 'bonus_expires_at')) {
                $table->dropColumn('bonus_expires_at');
            }
            if (Schema::hasColumn('wallet_accounts', 'recharge_blocked_reason')) {
                $table->dropColumn('recharge_blocked_reason');
            }
            if (Schema::hasColumn('wallet_accounts', 'recharge_blocked_at')) {
                $table->dropIndex(['recharge_blocked_at']);
                $table->dropColumn('recharge_blocked_at');
            }
        });
    }
};
