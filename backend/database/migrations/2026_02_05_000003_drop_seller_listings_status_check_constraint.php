<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        // Laravel's enum() on PostgreSQL creates a CHECK constraint like seller_listings_status_check.
        // We refactored statuses to a flexible workflow (draft/pending_review/approved/etc), so we must drop it.
        try {
            DB::statement("ALTER TABLE seller_listings DROP CONSTRAINT IF EXISTS seller_listings_status_check");
        } catch (\Throwable $e) {
            // best-effort
        }

        // Ensure the column is a plain varchar with a safe default.
        try {
            DB::statement("ALTER TABLE seller_listings ALTER COLUMN status TYPE VARCHAR(32)");
        } catch (\Throwable $e) {
            // best-effort
        }

        try {
            DB::statement("ALTER TABLE seller_listings ALTER COLUMN status SET DEFAULT 'draft'");
        } catch (\Throwable $e) {
            // best-effort
        }
    }

    public function down(): void
    {
        // No-op: we don't re-create enum/check constraints on rollback.
    }
};
