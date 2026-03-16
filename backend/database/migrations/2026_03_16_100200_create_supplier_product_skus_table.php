<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supplier_product_skus', function (Blueprint $table) {
            $table->id();
            $table->foreignId('supplier_product_id')->constrained()->cascadeOnDelete();
            $table->string('external_sku_id');
            $table->string('sku_label')->nullable();
            $table->json('variant_attributes_json')->nullable();
            $table->unsignedInteger('moq')->default(1);
            $table->decimal('unit_price', 12, 2)->nullable();
            $table->string('currency_code', 8)->nullable();
            $table->json('shipping_template_json')->nullable();
            $table->unsignedInteger('weight_grams')->nullable();
            $table->json('dimensions_json')->nullable();
            $table->unsignedInteger('available_quantity')->nullable();
            $table->unsignedInteger('lead_time_days')->nullable();
            $table->json('logistics_modes_json')->nullable();
            $table->json('sku_payload_json')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['supplier_product_id', 'external_sku_id'], 'supplier_product_skus_product_external_unique');
            $table->index(['supplier_product_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_product_skus');
    }
};