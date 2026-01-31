<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('payment_events', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 32);
            $table->string('tx_id', 191);
            $table->string('event', 191)->nullable();
            $table->string('status', 64)->nullable();
            $table->unsignedBigInteger('order_id')->nullable();
            $table->char('payload_hash', 64);
            $table->json('payload')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->index(['provider', 'tx_id']);
            $table->index('order_id');
            $table->unique(['provider', 'tx_id', 'event', 'payload_hash'], 'payment_events_provider_tx_event_hash_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_events');
    }
};
