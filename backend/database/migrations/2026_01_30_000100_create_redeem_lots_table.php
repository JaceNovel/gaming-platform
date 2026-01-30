<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('redeem_lots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('denomination_id')->constrained('redeem_denominations')->cascadeOnDelete();
            $table->string('code', 64)->unique();
            $table->string('label')->nullable();
            $table->string('supplier', 128)->nullable();
            $table->unsignedBigInteger('purchase_price_fcfa')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['denomination_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('redeem_lots');
    }
};
