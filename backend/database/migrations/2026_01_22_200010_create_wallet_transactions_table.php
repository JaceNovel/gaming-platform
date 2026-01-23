<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wallet_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('wallet_account_id')->constrained('wallet_accounts')->onDelete('cascade');
            $table->enum('type', ['credit', 'debit', 'hold', 'release']);
            $table->decimal('amount', 16, 2);
            $table->string('reference')->unique();
            $table->json('meta')->nullable();
            $table->enum('status', ['pending', 'success', 'failed'])->default('pending');
            $table->timestamps();
            $table->index(['wallet_account_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wallet_transactions');
    }
};
