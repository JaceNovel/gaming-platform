<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('partner_withdraw_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_wallet_id')->constrained('partner_wallets')->onDelete('cascade');
            $table->foreignId('seller_id')->constrained('sellers')->onDelete('cascade');

            $table->decimal('amount', 16, 2);
            $table->enum('status', ['requested', 'rejected', 'paid'])->default('requested');

            $table->json('payout_details')->nullable();

            $table->foreignId('processed_by_admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('processed_at')->nullable();
            $table->text('admin_note')->nullable();

            $table->timestamps();

            $table->index(['seller_id', 'status']);
            $table->index(['partner_wallet_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('partner_withdraw_requests');
    }
};
