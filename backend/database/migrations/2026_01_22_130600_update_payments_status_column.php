<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'sqlite') {
            return;
        }

        // Switch enum to varchar to allow initiated/paid/failed states
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE payments MODIFY status VARCHAR(32) NOT NULL DEFAULT 'pending'");
        } elseif ($driver === 'pgsql') {
            DB::statement("ALTER TABLE payments ALTER COLUMN status TYPE VARCHAR(32)");
            DB::statement("ALTER TABLE payments ALTER COLUMN status SET DEFAULT 'pending'");
            DB::statement("ALTER TABLE payments ALTER COLUMN status SET NOT NULL");
        } else {
            return;
        }

        DB::statement("UPDATE payments SET status = 'pending' WHERE status IS NULL");
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'sqlite') {
            return;
        }

        // Best-effort rollback to a nullable, no-default column for compatibility
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE payments MODIFY status VARCHAR(32) NULL DEFAULT NULL");
        } elseif ($driver === 'pgsql') {
            DB::statement("ALTER TABLE payments ALTER COLUMN status DROP NOT NULL");
            DB::statement("ALTER TABLE payments ALTER COLUMN status DROP DEFAULT");
        }
    }
};
