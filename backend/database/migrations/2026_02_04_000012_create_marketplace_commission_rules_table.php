<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('marketplace_commission_rules', function (Blueprint $table) {
            $table->id();

            // One global rule (category_id NULL) and optional per-category overrides.
            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();

            $table->enum('mode', ['fixed', 'percent'])->default('fixed');
            $table->decimal('fixed_amount', 16, 2)->nullable();
            $table->decimal('percent', 8, 4)->nullable();

            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->unique(['category_id']);
            $table->index(['is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketplace_commission_rules');
    }
};
