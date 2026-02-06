<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();

        // Normalize the column away from enum/check constraints and re-apply
        // a workflow-compatible constraint.
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE seller_listings MODIFY status VARCHAR(32) NOT NULL DEFAULT 'draft'");
        } elseif ($driver === 'pgsql') {
            DB::statement("ALTER TABLE seller_listings DROP CONSTRAINT IF EXISTS seller_listings_status_check");
            DB::statement("ALTER TABLE seller_listings ALTER COLUMN status TYPE VARCHAR(32) USING status::text");
            DB::statement("ALTER TABLE seller_listings ALTER COLUMN status SET DEFAULT 'draft'");

            // Re-create the constraint with the statuses used by the current moderation workflow.
            DB::statement("ALTER TABLE seller_listings ADD CONSTRAINT seller_listings_status_check CHECK (status IN ('draft','pending_review','pending_review_update','approved','rejected','suspended','sold'))");
        }

        // Map legacy values if they still exist in the database.
        DB::table('seller_listings')->whereNull('status')->update(['status' => 'draft']);
        DB::table('seller_listings')->where('status', 'active')->update(['status' => 'approved']);
        DB::table('seller_listings')->where('status', 'disabled')->update(['status' => 'draft']);
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE seller_listings DROP CONSTRAINT IF EXISTS seller_listings_status_check");
        }
    }
};
