<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('disputes', function (Blueprint $table) {
            if (!Schema::hasColumn('disputes', 'evidence')) {
                $table->json('evidence')->nullable()->after('reason');
            }
        });
    }

    public function down(): void
    {
        Schema::table('disputes', function (Blueprint $table) {
            if (Schema::hasColumn('disputes', 'evidence')) {
                $table->dropColumn('evidence');
            }
        });
    }
};
