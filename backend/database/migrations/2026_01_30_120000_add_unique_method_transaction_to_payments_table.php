<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            // Idempotence / anti double-webhook: make (method, transaction_id) unique.
            // MySQL allows multiple NULLs, so pending rows without transaction_id are unaffected.
            $table->unique(['method', 'transaction_id'], 'payments_method_transaction_unique');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropUnique('payments_method_transaction_unique');
        });
    }
};
