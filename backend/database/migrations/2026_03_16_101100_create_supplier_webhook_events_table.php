<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supplier_webhook_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('supplier_account_id')->nullable()->constrained()->nullOnDelete();
            $table->string('platform', 32);
            $table->string('event_type', 64)->nullable();
            $table->string('external_event_id')->nullable();
            $table->boolean('signature_valid')->default(false);
            $table->json('headers_json')->nullable();
            $table->json('payload_json')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->string('processing_status', 24)->default('pending');
            $table->text('processing_error')->nullable();
            $table->timestamps();

            $table->index(['platform', 'event_type']);
            $table->index(['external_event_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_webhook_events');
    }
};