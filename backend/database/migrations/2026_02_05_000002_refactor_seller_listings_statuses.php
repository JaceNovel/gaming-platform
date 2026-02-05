<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add moderation fields.
        Schema::table('seller_listings', function (Blueprint $table) {
            if (!Schema::hasColumn('seller_listings', 'submitted_at')) {
                $table->timestamp('submitted_at')->nullable()->after('status_reason');
            }
            if (!Schema::hasColumn('seller_listings', 'reviewed_at')) {
                $table->timestamp('reviewed_at')->nullable()->after('submitted_at');
            }
            if (!Schema::hasColumn('seller_listings', 'reviewed_by')) {
                $table->foreignId('reviewed_by')->nullable()->after('reviewed_at')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('seller_listings', 'approved_at')) {
                $table->timestamp('approved_at')->nullable()->after('reviewed_by');
            }
            if (!Schema::hasColumn('seller_listings', 'rejected_at')) {
                $table->timestamp('rejected_at')->nullable()->after('approved_at');
            }
            if (!Schema::hasColumn('seller_listings', 'suspended_at')) {
                $table->timestamp('suspended_at')->nullable()->after('rejected_at');
            }
        });

        // Convert status to a flexible string column to support moderation workflow.
        $driver = DB::getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE seller_listings MODIFY status VARCHAR(32) NOT NULL DEFAULT 'draft'");
        } elseif ($driver === 'pgsql') {
            // PostgreSQL: attempt to change type to varchar.
            DB::statement("ALTER TABLE seller_listings ALTER COLUMN status TYPE VARCHAR(32)");
            DB::statement("ALTER TABLE seller_listings ALTER COLUMN status SET DEFAULT 'draft'");
        }

        // Map legacy statuses.
        DB::table('seller_listings')->where('status', 'active')->update(['status' => 'approved']);
        DB::table('seller_listings')->where('status', 'disabled')->update(['status' => 'draft']);
        DB::table('seller_listings')->where('status', 'sold')->update(['status' => 'approved']);
    }

    public function down(): void
    {
        // Best-effort rollback: keep status as varchar to avoid enum complexities.
        Schema::table('seller_listings', function (Blueprint $table) {
            foreach (['submitted_at', 'reviewed_at', 'reviewed_by', 'approved_at', 'rejected_at', 'suspended_at'] as $col) {
                if (Schema::hasColumn('seller_listings', $col)) {
                    if ($col === 'reviewed_by') {
                        $table->dropConstrainedForeignId('reviewed_by');
                    } else {
                        $table->dropColumn($col);
                    }
                }
            }
        });
    }
};
