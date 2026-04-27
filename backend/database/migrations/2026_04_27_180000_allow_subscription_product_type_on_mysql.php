<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE products MODIFY COLUMN type ENUM('account','recharge','item','subscription') NOT NULL");
            return;
        }

        if ($driver === 'pgsql') {
            DB::statement("ALTER TABLE products DROP CONSTRAINT IF EXISTS products_type_check");
            DB::statement("ALTER TABLE products ADD CONSTRAINT products_type_check CHECK (type IN ('account','recharge','item','subscription'))");
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE products MODIFY COLUMN type ENUM('account','recharge','item') NOT NULL");
            return;
        }

        if ($driver === 'pgsql') {
            DB::statement("ALTER TABLE products DROP CONSTRAINT IF EXISTS products_type_check");
            DB::statement("ALTER TABLE products ADD CONSTRAINT products_type_check CHECK (type IN ('account','recharge','item'))");
        }
    }
};