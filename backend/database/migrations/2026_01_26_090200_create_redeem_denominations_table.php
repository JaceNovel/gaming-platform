<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('redeem_denominations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('code', 32)->unique();
            $table->string('label');
            $table->unsignedInteger('diamonds')->default(0);
            $table->boolean('active')->default(true);
            $table->unsignedInteger('low_stock_threshold')->default(20);
            $table->unsignedInteger('auto_reserve_seconds')->default(900);
            $table->json('meta')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('redeem_denominations');
    }
};
