<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('procurement_demands', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('order_item_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_supplier_link_id')->nullable()->constrained('product_supplier_links')->nullOnDelete();
            $table->foreignId('supplier_product_sku_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('quantity_requested');
            $table->unsignedInteger('quantity_allocated_from_stock')->default(0);
            $table->unsignedInteger('quantity_to_procure');
            $table->string('status', 24)->default('pending');
            $table->string('trigger_reason', 24)->default('stock_gap');
            $table->date('needed_by_date')->nullable();
            $table->timestamp('batch_locked_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'supplier_product_sku_id']);
            $table->index(['product_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('procurement_demands');
    }
};