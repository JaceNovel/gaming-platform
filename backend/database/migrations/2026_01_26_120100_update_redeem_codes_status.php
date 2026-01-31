<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }
        DB::statement("ALTER TABLE redeem_codes DROP CONSTRAINT IF EXISTS redeem_codes_status_check");
        DB::statement("ALTER TABLE redeem_codes ADD CONSTRAINT redeem_codes_status_check CHECK (status IN ('available','reserved','assigned','sent','used','expired'))");
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }
        DB::statement("ALTER TABLE redeem_codes DROP CONSTRAINT IF EXISTS redeem_codes_status_check");
        DB::statement("ALTER TABLE redeem_codes ADD CONSTRAINT redeem_codes_status_check CHECK (status IN ('available','reserved','assigned','sent','used'))");
    }
};
