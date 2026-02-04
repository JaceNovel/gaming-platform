<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seller_stats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_id')->unique()->constrained('sellers')->onDelete('cascade');

            $table->unsignedInteger('total_sales')->default(0);
            $table->unsignedInteger('successful_sales')->default(0);
            $table->unsignedInteger('disputed_sales')->default(0);
            $table->unsignedInteger('cancelled_sales')->default(0);

            $table->timestamp('last_sale_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seller_stats');
    }
};
