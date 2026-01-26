<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('redeem_denomination_id')->nullable()->constrained('redeem_denominations')->nullOnDelete();
            $table->integer('quantity');
            $table->string('direction', 16); // in|out|adjust
            $table->string('reason', 64)->nullable();
            $table->foreignId('admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['product_id', 'direction']);
            $table->index(['redeem_denomination_id', 'direction']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
