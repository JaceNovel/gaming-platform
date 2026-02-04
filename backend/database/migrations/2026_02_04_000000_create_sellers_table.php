<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sellers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->onDelete('cascade');

            $table->enum('status', ['pending_verification', 'approved', 'suspended', 'banned'])
                ->default('pending_verification');

            $table->string('whatsapp_number', 32);

            $table->string('kyc_full_name', 120);
            $table->date('kyc_dob')->nullable();
            $table->string('kyc_country', 64)->nullable();
            $table->string('kyc_city', 80)->nullable();
            $table->text('kyc_address')->nullable();
            $table->string('kyc_id_type', 32)->nullable();
            $table->string('kyc_id_number', 64)->nullable();

            $table->timestamp('kyc_submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('suspended_at')->nullable();
            $table->timestamp('banned_at')->nullable();
            $table->text('status_reason')->nullable();

            $table->boolean('partner_wallet_frozen')->default(false);
            $table->timestamp('partner_wallet_frozen_at')->nullable();

            $table->timestamps();

            $table->index(['status']);
            $table->index(['partner_wallet_frozen']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sellers');
    }
};
