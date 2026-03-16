<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_supplier_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('supplier_product_sku_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('priority')->default(1);
            $table->boolean('is_default')->default(false);
            $table->string('procurement_mode', 24)->default('manual_batch');
            $table->unsignedInteger('target_moq')->nullable();
            $table->unsignedInteger('reorder_point')->nullable();
            $table->unsignedInteger('reorder_quantity')->nullable();
            $table->unsignedInteger('safety_stock')->nullable();
            $table->string('warehouse_destination_label')->nullable();
            $table->unsignedInteger('expected_inbound_days')->nullable();
            $table->json('pricing_snapshot_json')->nullable();
            $table->timestamps();

            $table->unique(['product_id', 'supplier_product_sku_id'], 'product_supplier_links_product_sku_unique');
            $table->index(['product_id', 'is_default']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_supplier_links');
    }
};