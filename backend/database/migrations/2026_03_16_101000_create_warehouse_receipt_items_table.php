<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('warehouse_receipt_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('warehouse_receipt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('procurement_batch_item_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('supplier_product_sku_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('quantity_received');
            $table->unsignedInteger('quantity_damaged')->default(0);
            $table->unsignedInteger('quantity_missing')->default(0);
            $table->foreignId('stock_movement_id')->nullable()->constrained('stock_movements')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('warehouse_receipt_items');
    }
};