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
        DB::statement("ALTER TABLE products DROP CONSTRAINT IF EXISTS products_type_check");
        DB::statement("ALTER TABLE products ADD CONSTRAINT products_type_check CHECK (type IN ('account','recharge','item','subscription'))");
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }
        DB::statement("ALTER TABLE products DROP CONSTRAINT IF EXISTS products_type_check");
        DB::statement("ALTER TABLE products ADD CONSTRAINT products_type_check CHECK (type IN ('account','recharge','item'))");
    }
};