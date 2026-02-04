<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('marketplace_orders', function (Blueprint $table) {
            $table->id();

            $table->foreignId('order_id')->unique()->constrained('orders')->onDelete('cascade');
            $table->foreignId('seller_listing_id')->unique()->constrained('seller_listings')->onDelete('cascade');

            $table->foreignId('seller_id')->constrained('sellers')->onDelete('cascade');
            $table->foreignId('buyer_id')->constrained('users')->onDelete('cascade');

            $table->enum('status', [
                'paid',
                'delivered',
                'disputed',
                'resolved_refund',
                'resolved_release',
            ])->default('paid');

            $table->decimal('price', 16, 2);
            $table->decimal('commission_amount', 16, 2)->default(400);
            $table->decimal('seller_earnings', 16, 2);

            $table->timestamp('delivery_deadline_at')->nullable();
            $table->timestamp('whatsapp_revealed_at')->nullable();

            $table->timestamp('delivered_at')->nullable();
            $table->json('delivery_proof')->nullable();

            $table->foreignId('dispute_id')->nullable()->constrained('disputes')->nullOnDelete();

            $table->timestamps();

            $table->index(['seller_id', 'status']);
            $table->index(['buyer_id', 'status']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketplace_orders');
    }
};
