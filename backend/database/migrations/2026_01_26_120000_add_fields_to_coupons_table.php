<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('coupons', function (Blueprint $table) {
            $table->string('name')->nullable()->after('id');
            $table->text('description')->nullable()->after('code');
            $table->string('type')->default('percent')->after('description');
            $table->decimal('discount_value', 10, 2)->nullable()->after('discount_percent');
            $table->integer('max_uses')->nullable()->after('discount_value');
            $table->integer('uses_count')->default(0)->after('max_uses');
            $table->timestamp('starts_at')->nullable()->after('uses_count');
            $table->timestamp('ends_at')->nullable()->after('starts_at');
        });
    }

    public function down(): void
    {
        Schema::table('coupons', function (Blueprint $table) {
            $table->dropColumn([
                'name',
                'description',
                'type',
                'discount_value',
                'max_uses',
                'uses_count',
                'starts_at',
                'ends_at',
            ]);
        });
    }
};
