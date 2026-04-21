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

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY role VARCHAR(32) NOT NULL DEFAULT 'user'");
        } elseif ($driver === 'pgsql') {
            DB::statement("ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(32)");
            DB::statement("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user'");
            DB::statement("ALTER TABLE users ALTER COLUMN role SET NOT NULL");
        } else {
            return;
        }

        DB::statement("UPDATE users SET role = 'user' WHERE role IS NULL");

        if ($driver === 'pgsql') {
            DB::statement("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
            DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user','admin','admin_super','admin_article','admin_client'))");
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'sqlite') {
            return;
        }

        if ($driver === 'pgsql') {
            DB::statement("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
            DB::statement("ALTER TABLE users ALTER COLUMN role DROP DEFAULT");
            DB::statement("ALTER TABLE users ALTER COLUMN role DROP NOT NULL");
        } elseif ($driver === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY role VARCHAR(32) NULL DEFAULT NULL");
        }
    }
};
