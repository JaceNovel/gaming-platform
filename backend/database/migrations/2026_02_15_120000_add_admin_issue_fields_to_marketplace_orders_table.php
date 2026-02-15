<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('marketplace_orders', function (Blueprint $table) {
            $table->boolean('admin_issue_flag')->default(false)->after('dispute_id');
            $table->string('admin_issue_reason', 255)->nullable()->after('admin_issue_flag');
            $table->timestamp('auto_refunded_at')->nullable()->after('admin_issue_reason');
            $table->string('auto_refund_reference', 100)->nullable()->after('auto_refunded_at');

            $table->index(['admin_issue_flag', 'created_at']);
            $table->index('auto_refunded_at');
        });
    }

    public function down(): void
    {
        Schema::table('marketplace_orders', function (Blueprint $table) {
            $table->dropIndex(['admin_issue_flag', 'created_at']);
            $table->dropIndex(['auto_refunded_at']);
            $table->dropColumn([
                'admin_issue_flag',
                'admin_issue_reason',
                'auto_refunded_at',
                'auto_refund_reference',
            ]);
        });
    }
};
