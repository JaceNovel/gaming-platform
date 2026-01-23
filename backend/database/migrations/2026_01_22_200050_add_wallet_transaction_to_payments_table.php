<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            if (!Schema::hasColumn('payments', 'wallet_transaction_id')) {
                $table->uuid('wallet_transaction_id')->nullable()->after('order_id');
                $table->foreign('wallet_transaction_id')->references('id')->on('wallet_transactions')->onDelete('set null');
            }
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            if (Schema::hasColumn('payments', 'wallet_transaction_id')) {
                $table->dropForeign(['wallet_transaction_id']);
                $table->dropColumn('wallet_transaction_id');
            }
        });
    }
};
