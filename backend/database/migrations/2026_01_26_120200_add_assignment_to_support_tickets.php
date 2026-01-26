<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('support_tickets', function (Blueprint $table) {
            if (!Schema::hasColumn('support_tickets', 'assigned_admin_id')) {
                $table->foreignId('assigned_admin_id')
                    ->nullable()
                    ->after('user_id')
                    ->constrained('users')
                    ->nullOnDelete();
            }

            if (!Schema::hasColumn('support_tickets', 'assigned_at')) {
                $table->timestamp('assigned_at')->nullable()->after('last_message_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('support_tickets', function (Blueprint $table) {
            if (Schema::hasColumn('support_tickets', 'assigned_admin_id')) {
                $table->dropConstrainedForeignId('assigned_admin_id');
            }

            if (Schema::hasColumn('support_tickets', 'assigned_at')) {
                $table->dropColumn('assigned_at');
            }
        });
    }
};
