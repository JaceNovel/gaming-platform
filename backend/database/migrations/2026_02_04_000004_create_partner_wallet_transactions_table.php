<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('partner_wallet_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('partner_wallet_id')->constrained('partner_wallets')->onDelete('cascade');

            $table->enum('type', [
                'credit_pending',
                'release_to_available',
                'debit_withdraw',
                'freeze',
                'unfreeze',
                'adjustment',
            ]);

            $table->decimal('amount', 16, 2);
            $table->string('reference')->unique();
            $table->json('meta')->nullable();
            $table->enum('status', ['pending', 'success', 'failed'])->default('success');

            $table->timestamps();

            $table->index(['partner_wallet_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('partner_wallet_transactions');
    }
};
