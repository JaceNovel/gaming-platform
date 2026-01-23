<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payouts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('wallet_account_id')->constrained('wallet_accounts')->onDelete('cascade');
            $table->decimal('amount', 16, 2);
            $table->decimal('fee', 16, 2)->default(0);
            $table->decimal('total_debit', 16, 2);
            $table->string('currency', 8)->default('FCFA');
            $table->string('country', 4);
            $table->string('phone', 32);
            $table->string('provider')->default('CINETPAY');
            $table->string('provider_ref')->nullable();
            $table->enum('status', ['queued', 'processing', 'sent', 'failed', 'cancelled'])->default('queued');
            $table->text('failure_reason')->nullable();
            $table->string('idempotency_key')->unique();
            $table->timestamps();
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payouts');
    }
};
