<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('procurement_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('supplier_account_id')->constrained()->cascadeOnDelete();
            $table->string('batch_number')->unique();
            $table->string('status', 32)->default('draft');
            $table->string('currency_code', 8)->nullable();
            $table->string('warehouse_destination_label')->nullable();
            $table->json('warehouse_address_json')->nullable();
            $table->string('grouping_key')->nullable();
            $table->string('supplier_order_reference')->nullable();
            $table->json('supplier_order_payload_json')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->date('expected_ship_date')->nullable();
            $table->date('expected_arrival_date')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['supplier_account_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('procurement_batches');
    }
};