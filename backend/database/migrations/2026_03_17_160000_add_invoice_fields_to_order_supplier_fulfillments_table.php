<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('order_supplier_fulfillments')) {
            return;
        }

        Schema::table('order_supplier_fulfillments', function (Blueprint $table) {
            if (!Schema::hasColumn('order_supplier_fulfillments', 'invoice_customer_id')) {
                $table->string('invoice_customer_id')->nullable()->after('refund_address_id');
            }
            if (!Schema::hasColumn('order_supplier_fulfillments', 'invoice_status')) {
                $table->string('invoice_status', 64)->nullable()->after('invoice_customer_id');
            }
            if (!Schema::hasColumn('order_supplier_fulfillments', 'invoice_request_no')) {
                $table->string('invoice_request_no')->nullable()->after('invoice_status');
            }
            if (!Schema::hasColumn('order_supplier_fulfillments', 'invoice_no')) {
                $table->string('invoice_no')->nullable()->after('invoice_request_no');
            }
            if (!Schema::hasColumn('order_supplier_fulfillments', 'invoice_date')) {
                $table->timestamp('invoice_date')->nullable()->after('invoice_no');
            }
            if (!Schema::hasColumn('order_supplier_fulfillments', 'invoice_file_type')) {
                $table->string('invoice_file_type', 16)->nullable()->after('invoice_date');
            }
            if (!Schema::hasColumn('order_supplier_fulfillments', 'invoice_file_name')) {
                $table->string('invoice_file_name')->nullable()->after('invoice_file_type');
            }
            if (!Schema::hasColumn('order_supplier_fulfillments', 'invoice_direction')) {
                $table->string('invoice_direction', 16)->nullable()->after('invoice_file_name');
            }
            if (!Schema::hasColumn('order_supplier_fulfillments', 'invoice_file_path')) {
                $table->text('invoice_file_path')->nullable()->after('invoice_direction');
            }
            if (!Schema::hasColumn('order_supplier_fulfillments', 'invoice_document_url')) {
                $table->text('invoice_document_url')->nullable()->after('invoice_file_path');
            }
            if (!Schema::hasColumn('order_supplier_fulfillments', 'invoice_latest_request_payload_json')) {
                $table->json('invoice_latest_request_payload_json')->nullable()->after('invoice_document_url');
            }
            if (!Schema::hasColumn('order_supplier_fulfillments', 'invoice_latest_response_payload_json')) {
                $table->json('invoice_latest_response_payload_json')->nullable()->after('invoice_latest_request_payload_json');
            }
            if (!Schema::hasColumn('order_supplier_fulfillments', 'invoice_requested_at')) {
                $table->timestamp('invoice_requested_at')->nullable()->after('invoice_latest_response_payload_json');
            }
            if (!Schema::hasColumn('order_supplier_fulfillments', 'invoice_uploaded_at')) {
                $table->timestamp('invoice_uploaded_at')->nullable()->after('invoice_requested_at');
            }
            if (!Schema::hasColumn('order_supplier_fulfillments', 'invoice_pushed_at')) {
                $table->timestamp('invoice_pushed_at')->nullable()->after('invoice_uploaded_at');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('order_supplier_fulfillments')) {
            return;
        }

        Schema::table('order_supplier_fulfillments', function (Blueprint $table) {
            foreach ([
                'invoice_pushed_at',
                'invoice_uploaded_at',
                'invoice_requested_at',
                'invoice_latest_response_payload_json',
                'invoice_latest_request_payload_json',
                'invoice_document_url',
                'invoice_file_path',
                'invoice_direction',
                'invoice_file_name',
                'invoice_file_type',
                'invoice_date',
                'invoice_no',
                'invoice_request_no',
                'invoice_status',
                'invoice_customer_id',
            ] as $column) {
                if (Schema::hasColumn('order_supplier_fulfillments', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};