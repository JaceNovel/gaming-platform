<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seller_listings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_id')->constrained('sellers')->onDelete('cascade');

            $table->foreignId('game_id')->nullable()->constrained('games')->nullOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();

            $table->string('title', 140);
            $table->text('description')->nullable();

            $table->decimal('price', 16, 2);
            $table->string('currency', 8)->default('FCFA');

            $table->string('account_level', 64)->nullable();
            $table->string('account_rank', 64)->nullable();
            $table->string('account_region', 64)->nullable();
            $table->boolean('has_email_access')->default(false);

            $table->unsignedSmallInteger('delivery_window_hours')->default(24);

            $table->enum('status', ['active', 'disabled', 'sold'])->default('disabled');
            $table->text('status_reason')->nullable();

            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->timestamp('sold_at')->nullable();

            $table->timestamps();

            $table->index(['seller_id', 'status']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seller_listings');
    }
};
