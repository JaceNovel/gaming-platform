<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('redeem_stock_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('denomination_id')->constrained('redeem_denominations')->cascadeOnDelete();
            $table->integer('last_notified_stock')->nullable();
            $table->timestamp('last_notified_at')->nullable();
            $table->string('channel')->nullable();
            $table->timestamps();

            $table->unique('denomination_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('redeem_stock_alerts');
    }
};
