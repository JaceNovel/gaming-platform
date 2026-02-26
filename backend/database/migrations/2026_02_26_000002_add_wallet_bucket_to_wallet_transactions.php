<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wallet_transactions', function (Blueprint $table) {
            if (!Schema::hasColumn('wallet_transactions', 'wallet_bucket')) {
                $table->string('wallet_bucket', 16)->default('main')->after('wallet_account_id');
                $table->index(['wallet_account_id', 'wallet_bucket', 'created_at'], 'wallet_tx_wallet_bucket_created_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::table('wallet_transactions', function (Blueprint $table) {
            if (Schema::hasColumn('wallet_transactions', 'wallet_bucket')) {
                $table->dropIndex('wallet_tx_wallet_bucket_created_idx');
                $table->dropColumn('wallet_bucket');
            }
        });
    }
};
