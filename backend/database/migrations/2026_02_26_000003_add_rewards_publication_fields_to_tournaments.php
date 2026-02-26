<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $table) {
            if (!Schema::hasColumn('tournaments', 'rewards_published_at')) {
                $table->timestamp('rewards_published_at')->nullable()->after('planning_notes');
            }

            if (!Schema::hasColumn('tournaments', 'rewards_banner_expires_at')) {
                $table->timestamp('rewards_banner_expires_at')->nullable()->after('rewards_published_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tournaments', function (Blueprint $table) {
            if (Schema::hasColumn('tournaments', 'rewards_banner_expires_at')) {
                $table->dropColumn('rewards_banner_expires_at');
            }

            if (Schema::hasColumn('tournaments', 'rewards_published_at')) {
                $table->dropColumn('rewards_published_at');
            }
        });
    }
};
