<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wallet_transactions', function (Blueprint $table) {
            if (!Schema::hasColumn('wallet_transactions', 'provider')) {
                $table->string('provider', 32)->nullable()->after('status');
            }
            if (!Schema::hasColumn('wallet_transactions', 'provider_transaction_id')) {
                $table->string('provider_transaction_id', 64)->nullable()->after('provider');
            }
            if (!Schema::hasColumn('wallet_transactions', 'provider_reference')) {
                $table->string('provider_reference', 191)->nullable()->after('provider_transaction_id');
            }
            if (!Schema::hasColumn('wallet_transactions', 'paid_at')) {
                $table->timestamp('paid_at')->nullable()->after('provider_reference');
            }
        });

        Schema::table('wallet_transactions', function (Blueprint $table) {
            // Idempotency: prevent double credits on provider retries.
            if (Schema::hasColumn('wallet_transactions', 'provider_transaction_id')) {
                $table->unique('provider_transaction_id', 'wallet_tx_provider_transaction_id_unique');
            }
        });
    }

    public function down(): void
    {
        Schema::table('wallet_transactions', function (Blueprint $table) {
            if (Schema::hasColumn('wallet_transactions', 'provider_transaction_id')) {
                $table->dropUnique('wallet_tx_provider_transaction_id_unique');
            }
        });

        Schema::table('wallet_transactions', function (Blueprint $table) {
            if (Schema::hasColumn('wallet_transactions', 'paid_at')) {
                $table->dropColumn('paid_at');
            }
            if (Schema::hasColumn('wallet_transactions', 'provider_reference')) {
                $table->dropColumn('provider_reference');
            }
            if (Schema::hasColumn('wallet_transactions', 'provider_transaction_id')) {
                $table->dropColumn('provider_transaction_id');
            }
            if (Schema::hasColumn('wallet_transactions', 'provider')) {
                $table->dropColumn('provider');
            }
        });
    }
};
