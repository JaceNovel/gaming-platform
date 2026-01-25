<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Switch enum to varchar to allow initiated/paid/failed states
        DB::statement("ALTER TABLE payments ALTER COLUMN status TYPE VARCHAR(32)");
        DB::statement("UPDATE payments SET status = 'pending' WHERE status IS NULL");
        DB::statement("ALTER TABLE payments ALTER COLUMN status SET DEFAULT 'pending'");
        DB::statement("ALTER TABLE payments ALTER COLUMN status SET NOT NULL");
    }

    public function down(): void
    {
        // Best-effort rollback to a nullable, no-default column for compatibility
        DB::statement("ALTER TABLE payments ALTER COLUMN status DROP NOT NULL");
        DB::statement("ALTER TABLE payments ALTER COLUMN status DROP DEFAULT");
    }
};
