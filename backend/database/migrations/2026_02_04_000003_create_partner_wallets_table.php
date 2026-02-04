<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('partner_wallets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_id')->unique()->constrained('sellers')->onDelete('cascade');

            $table->string('currency', 8)->default('FCFA');
            $table->decimal('available_balance', 16, 2)->default(0);
            $table->decimal('pending_balance', 16, 2)->default(0);

            $table->enum('status', ['active', 'frozen'])->default('active');
            $table->text('status_reason')->nullable();
            $table->timestamp('frozen_at')->nullable();

            $table->timestamps();

            $table->index(['status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('partner_wallets');
    }
};
