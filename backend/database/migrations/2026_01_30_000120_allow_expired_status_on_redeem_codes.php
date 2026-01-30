<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('redeem_codes')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        // Laravel "enum" becomes:
        // - MySQL: ENUM
        // - Postgres: CHECK constraint (typically <table>_<column>_check)
        // We add 'expired' for admin invalidation.
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE redeem_codes MODIFY status ENUM('available','reserved','assigned','sent','used','expired') NOT NULL DEFAULT 'available'");
            return;
        }

        if ($driver === 'pgsql') {
            DB::statement("ALTER TABLE redeem_codes DROP CONSTRAINT IF EXISTS redeem_codes_status_check");
            DB::statement("ALTER TABLE redeem_codes ADD CONSTRAINT redeem_codes_status_check CHECK (status IN ('available','reserved','assigned','sent','used','expired'))");
            return;
        }

        // sqlite / others: no-op
    }

    public function down(): void
    {
        if (!Schema::hasTable('redeem_codes')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE redeem_codes MODIFY status ENUM('available','reserved','assigned','sent','used') NOT NULL DEFAULT 'available'");
            return;
        }

        if ($driver === 'pgsql') {
            DB::statement("ALTER TABLE redeem_codes DROP CONSTRAINT IF EXISTS redeem_codes_status_check");
            DB::statement("ALTER TABLE redeem_codes ADD CONSTRAINT redeem_codes_status_check CHECK (status IN ('available','reserved','assigned','sent','used'))");
            return;
        }
    }
};
