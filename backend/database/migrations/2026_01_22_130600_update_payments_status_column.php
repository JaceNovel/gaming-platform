<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Switch enum to varchar to allow initiated/paid/failed states
        DB::statement("ALTER TABLE payments MODIFY status VARCHAR(32) NOT NULL DEFAULT 'pending'");
    }

    public function down(): void
    {
        // Best-effort rollback to original enum
        DB::statement("ALTER TABLE payments MODIFY status ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending'");
    }
};
