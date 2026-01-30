<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('redeem_codes', function (Blueprint $table) {
            if (!Schema::hasColumn('redeem_codes', 'lot_id')) {
                $table->foreignId('lot_id')->nullable()->after('denomination_id')->constrained('redeem_lots')->nullOnDelete();
                $table->index(['lot_id', 'status']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('redeem_codes', function (Blueprint $table) {
            if (Schema::hasColumn('redeem_codes', 'lot_id')) {
                $table->dropConstrainedForeignId('lot_id');
            }
        });
    }
};
