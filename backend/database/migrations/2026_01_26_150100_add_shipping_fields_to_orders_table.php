<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'shipping_status')) {
                $table->string('shipping_status', 32)->default('pending')->after('status');
            }
            if (!Schema::hasColumn('orders', 'shipping_eta_days')) {
                $table->integer('shipping_eta_days')->nullable()->after('shipping_status');
            }
            if (!Schema::hasColumn('orders', 'shipping_estimated_date')) {
                $table->timestamp('shipping_estimated_date')->nullable()->after('shipping_eta_days');
            }
            if (!Schema::hasColumn('orders', 'shipping_document_path')) {
                $table->string('shipping_document_path')->nullable()->after('shipping_estimated_date');
            }
            if (!Schema::hasColumn('orders', 'delivered_at')) {
                $table->timestamp('delivered_at')->nullable()->after('shipping_document_path');
            }
            if (!Schema::hasColumn('orders', 'shipping_address_line1')) {
                $table->string('shipping_address_line1')->nullable()->after('delivered_at');
            }
            if (!Schema::hasColumn('orders', 'shipping_city')) {
                $table->string('shipping_city', 80)->nullable()->after('shipping_address_line1');
            }
            if (!Schema::hasColumn('orders', 'shipping_country_code')) {
                $table->string('shipping_country_code', 2)->nullable()->after('shipping_city');
            }
            if (!Schema::hasColumn('orders', 'shipping_phone')) {
                $table->string('shipping_phone', 32)->nullable()->after('shipping_country_code');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $columns = [
                'shipping_phone',
                'shipping_country_code',
                'shipping_city',
                'shipping_address_line1',
                'delivered_at',
                'shipping_document_path',
                'shipping_estimated_date',
                'shipping_eta_days',
                'shipping_status',
            ];
            foreach ($columns as $column) {
                if (Schema::hasColumn('orders', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
