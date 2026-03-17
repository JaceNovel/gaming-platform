<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'preferred_supplier_platform')) {
                $table->string('preferred_supplier_platform', 32)->nullable()->after('delivery_type');
            }
            if (!Schema::hasColumn('products', 'supplier_shipping_mode')) {
                $table->string('supplier_shipping_mode', 24)->default('immediate')->after('preferred_supplier_platform');
            }
            if (!Schema::hasColumn('products', 'grouping_threshold')) {
                $table->unsignedInteger('grouping_threshold')->default(0)->after('supplier_shipping_mode');
            }
            if (!Schema::hasColumn('products', 'grouping_current_count')) {
                $table->unsignedInteger('grouping_current_count')->default(0)->after('grouping_threshold');
            }
            if (!Schema::hasColumn('products', 'supplier_margin_type')) {
                $table->string('supplier_margin_type', 16)->nullable()->after('grouping_current_count');
            }
            if (!Schema::hasColumn('products', 'supplier_margin_value')) {
                $table->decimal('supplier_margin_value', 10, 2)->nullable()->after('supplier_margin_type');
            }
            if (!Schema::hasColumn('products', 'supplier_shipping_fee')) {
                $table->decimal('supplier_shipping_fee', 10, 2)->nullable()->after('supplier_margin_value');
            }
        });

        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'supplier_fulfillment_status')) {
                $table->string('supplier_fulfillment_status', 32)->default('pending')->after('status');
            }
            if (!Schema::hasColumn('orders', 'supplier_platform')) {
                $table->string('supplier_platform', 32)->nullable()->after('supplier_fulfillment_status');
            }
            if (!Schema::hasColumn('orders', 'supplier_country_code')) {
                $table->string('supplier_country_code', 2)->nullable()->after('supplier_platform');
            }
            if (!Schema::hasColumn('orders', 'supplier_receiving_address_id')) {
                $table->foreignId('supplier_receiving_address_id')->nullable()->after('supplier_country_code')->constrained('supplier_receiving_addresses')->nullOnDelete();
            }
            if (!Schema::hasColumn('orders', 'grouping_released_at')) {
                $table->timestamp('grouping_released_at')->nullable()->after('supplier_receiving_address_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $columns = [
                'grouping_released_at',
                'supplier_receiving_address_id',
                'supplier_country_code',
                'supplier_platform',
                'supplier_fulfillment_status',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('orders', $column)) {
                    if ($column === 'supplier_receiving_address_id') {
                        $table->dropConstrainedForeignId($column);
                    } else {
                        $table->dropColumn($column);
                    }
                }
            }
        });

        Schema::table('products', function (Blueprint $table) {
            $columns = [
                'supplier_shipping_fee',
                'supplier_margin_value',
                'supplier_margin_type',
                'grouping_current_count',
                'grouping_threshold',
                'supplier_shipping_mode',
                'preferred_supplier_platform',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('products', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};