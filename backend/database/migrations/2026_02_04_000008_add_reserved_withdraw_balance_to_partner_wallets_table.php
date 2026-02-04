<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('partner_wallets', function (Blueprint $table) {
            $table->decimal('reserved_withdraw_balance', 16, 2)->default(0)->after('pending_balance');
        });
    }

    public function down(): void
    {
        Schema::table('partner_wallets', function (Blueprint $table) {
            $table->dropColumn('reserved_withdraw_balance');
        });
    }
};
