<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('procurement_batch_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('procurement_batch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('supplier_product_sku_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('product_supplier_link_id')->nullable()->constrained('product_supplier_links')->nullOnDelete();
            $table->unsignedInteger('quantity_ordered');
            $table->decimal('unit_price', 12, 2)->nullable();
            $table->string('currency_code', 8)->nullable();
            $table->decimal('line_total', 12, 2)->nullable();
            $table->json('source_snapshot_json')->nullable();
            $table->timestamps();

            $table->index(['procurement_batch_id', 'supplier_product_sku_id'], 'procurement_batch_items_batch_sku_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('procurement_batch_items');
    }
};