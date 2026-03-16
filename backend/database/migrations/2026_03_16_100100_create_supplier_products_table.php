<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supplier_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('supplier_account_id')->constrained()->cascadeOnDelete();
            $table->string('external_product_id');
            $table->string('external_offer_id')->nullable();
            $table->string('title');
            $table->string('slug')->nullable();
            $table->string('supplier_name')->nullable();
            $table->text('source_url')->nullable();
            $table->text('main_image_url')->nullable();
            $table->json('category_path_json')->nullable();
            $table->json('attributes_json')->nullable();
            $table->json('product_payload_json')->nullable();
            $table->string('status', 24)->default('imported');
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();

            $table->unique(['supplier_account_id', 'external_product_id'], 'supplier_products_account_external_unique');
            $table->index(['supplier_account_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_products');
    }
};