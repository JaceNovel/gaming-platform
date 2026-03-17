<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'supplier_account_id')) {
                $table->foreignId('supplier_account_id')->nullable()->after('supplier_platform')->constrained('supplier_accounts')->nullOnDelete();
            }
            if (!Schema::hasColumn('orders', 'supplier_external_order_id')) {
                $table->string('supplier_external_order_id', 255)->nullable()->after('supplier_account_id');
            }
            if (!Schema::hasColumn('orders', 'supplier_shipping_mode')) {
                $table->string('supplier_shipping_mode', 64)->nullable()->after('supplier_external_order_id');
            }
            if (!Schema::hasColumn('orders', 'supplier_package_id')) {
                $table->string('supplier_package_id', 255)->nullable()->after('supplier_shipping_mode');
            }
            if (!Schema::hasColumn('orders', 'supplier_tracking_number')) {
                $table->string('supplier_tracking_number', 255)->nullable()->after('supplier_package_id');
            }
            if (!Schema::hasColumn('orders', 'supplier_shipping_provider_code')) {
                $table->string('supplier_shipping_provider_code', 255)->nullable()->after('supplier_tracking_number');
            }
            if (!Schema::hasColumn('orders', 'supplier_shipping_provider_name')) {
                $table->string('supplier_shipping_provider_name', 255)->nullable()->after('supplier_shipping_provider_code');
            }
            if (!Schema::hasColumn('orders', 'supplier_document_url')) {
                $table->text('supplier_document_url')->nullable()->after('supplier_shipping_provider_name');
            }
        });

        if (!Schema::hasTable('order_supplier_fulfillments')) {
            Schema::create('order_supplier_fulfillments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('order_id')->constrained()->cascadeOnDelete();
                $table->foreignId('supplier_account_id')->nullable()->constrained('supplier_accounts')->nullOnDelete();
                $table->string('platform', 32)->default('aliexpress');
                $table->string('external_order_id')->nullable();
                $table->json('external_order_lines_json')->nullable();
                $table->string('seller_id')->nullable();
                $table->string('locale', 16)->nullable();
                $table->string('shipping_mode', 64)->nullable();
                $table->string('shipping_provider_code')->nullable();
                $table->string('shipping_provider_name')->nullable();
                $table->string('carrier_code')->nullable();
                $table->string('tracking_number')->nullable();
                $table->string('package_id')->nullable();
                $table->string('pickup_address_id')->nullable();
                $table->string('refund_address_id')->nullable();
                $table->string('asf_status', 64)->nullable();
                $table->string('asf_sub_status', 255)->nullable();
                $table->string('latest_document_type', 64)->nullable();
                $table->text('document_url')->nullable();
                $table->longText('document_bytes_base64')->nullable();
                $table->json('resolved_shipping_services_json')->nullable();
                $table->json('latest_request_payload_json')->nullable();
                $table->json('latest_response_payload_json')->nullable();
                $table->json('metadata_json')->nullable();
                $table->timestamp('last_synced_at')->nullable();
                $table->timestamp('packed_at')->nullable();
                $table->timestamp('shipped_at')->nullable();
                $table->timestamp('repacked_at')->nullable();
                $table->timestamp('waybill_printed_at')->nullable();
                $table->timestamps();

                $table->unique(['order_id', 'platform']);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('order_supplier_fulfillments')) {
            Schema::dropIfExists('order_supplier_fulfillments');
        }

        Schema::table('orders', function (Blueprint $table) {
            $columns = [
                'supplier_document_url',
                'supplier_shipping_provider_name',
                'supplier_shipping_provider_code',
                'supplier_tracking_number',
                'supplier_package_id',
                'supplier_shipping_mode',
                'supplier_external_order_id',
                'supplier_account_id',
            ];

            foreach ($columns as $column) {
                if (!Schema::hasColumn('orders', $column)) {
                    continue;
                }

                if ($column === 'supplier_account_id') {
                    $table->dropConstrainedForeignId($column);
                    continue;
                }

                $table->dropColumn($column);
            }
        });
    }
};