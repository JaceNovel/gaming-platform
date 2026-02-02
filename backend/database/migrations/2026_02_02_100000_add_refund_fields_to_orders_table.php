<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'refunded_amount')) {
                $table->decimal('refunded_amount', 16, 2)->default(0)->after('total_price');
            }
            if (!Schema::hasColumn('orders', 'status_refund')) {
                $table->string('status_refund', 16)->default('none')->after('refunded_amount');
            }
            if (!Schema::hasColumn('orders', 'refunded_at')) {
                $table->timestamp('refunded_at')->nullable()->after('status_refund');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'refunded_at')) {
                $table->dropColumn('refunded_at');
            }
            if (Schema::hasColumn('orders', 'status_refund')) {
                $table->dropColumn('status_refund');
            }
            if (Schema::hasColumn('orders', 'refunded_amount')) {
                $table->dropColumn('refunded_amount');
            }
        });
    }
};
