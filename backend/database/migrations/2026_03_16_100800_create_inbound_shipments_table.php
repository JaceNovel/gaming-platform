<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inbound_shipments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('procurement_batch_id')->constrained()->cascadeOnDelete();
            $table->string('shipment_reference')->nullable();
            $table->string('carrier_name')->nullable();
            $table->string('tracking_number')->nullable();
            $table->text('tracking_url')->nullable();
            $table->string('status', 32)->default('pending');
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('arrived_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->json('shipment_payload_json')->nullable();
            $table->timestamps();

            $table->index(['procurement_batch_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inbound_shipments');
    }
};