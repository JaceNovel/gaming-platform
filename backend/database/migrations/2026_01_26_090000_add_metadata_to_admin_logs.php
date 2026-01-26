<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('admin_logs', function (Blueprint $table) {
            if (!Schema::hasColumn('admin_logs', 'action_type')) {
                $table->string('action_type', 64)->nullable()->after('action');
            }

            if (!Schema::hasColumn('admin_logs', 'metadata')) {
                $table->json('metadata')->nullable()->after('details');
            }

            if (!Schema::hasColumn('admin_logs', 'ip_address')) {
                $table->string('ip_address', 64)->nullable()->after('metadata');
            }

            if (!Schema::hasColumn('admin_logs', 'user_agent')) {
                $table->string('user_agent')->nullable()->after('ip_address');
            }

            if (!Schema::hasColumn('admin_logs', 'performed_at')) {
                $table->timestamp('performed_at')->nullable()->after('user_agent');
            }
        });
    }

    public function down(): void
    {
        Schema::table('admin_logs', function (Blueprint $table) {
            if (Schema::hasColumn('admin_logs', 'action_type')) {
                $table->dropColumn('action_type');
            }

            if (Schema::hasColumn('admin_logs', 'metadata')) {
                $table->dropColumn('metadata');
            }

            if (Schema::hasColumn('admin_logs', 'ip_address')) {
                $table->dropColumn('ip_address');
            }

            if (Schema::hasColumn('admin_logs', 'user_agent')) {
                $table->dropColumn('user_agent');
            }

            if (Schema::hasColumn('admin_logs', 'performed_at')) {
                $table->dropColumn('performed_at');
            }
        });
    }
};
