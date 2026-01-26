<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('redeem_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('denomination_id')->constrained('redeem_denominations')->cascadeOnDelete();
            $table->string('code')->unique();
            $table->enum('status', ['available', 'reserved', 'assigned', 'sent', 'used'])->default('available');
            $table->timestamp('reserved_until')->nullable();
            $table->foreignId('assigned_order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->foreignId('assigned_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('revealed_at')->nullable();
            $table->timestamp('last_resend_at')->nullable();
            $table->foreignId('imported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('imported_at')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['denomination_id', 'status']);
            $table->index('reserved_until');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('redeem_codes');
    }
};
