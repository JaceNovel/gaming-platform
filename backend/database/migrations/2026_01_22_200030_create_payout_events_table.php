<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payout_events', function (Blueprint $table) {
            $table->id();
            $table->uuid('payout_id');
            $table->json('provider_payload')->nullable();
            $table->string('status');
            $table->timestamps();

            $table->foreign('payout_id')->references('id')->on('payouts')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payout_events');
    }
};
