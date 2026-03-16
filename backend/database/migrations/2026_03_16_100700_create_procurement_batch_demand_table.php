<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('procurement_batch_demand', function (Blueprint $table) {
            $table->id();
            $table->foreignId('procurement_batch_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('procurement_demand_id')->constrained('procurement_demands')->cascadeOnDelete();
            $table->unsignedInteger('quantity_covered');
            $table->timestamps();

            $table->unique(['procurement_batch_item_id', 'procurement_demand_id'], 'procurement_batch_demand_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('procurement_batch_demand');
    }
};