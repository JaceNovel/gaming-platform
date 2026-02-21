<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('tournaments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('status', 32)->default('upcoming');
            $table->boolean('is_active')->default(true);
            $table->boolean('is_free')->default(false);
            $table->unsignedInteger('prize_pool_fcfa')->default(0);
            $table->unsignedInteger('entry_fee_fcfa')->default(0);
            $table->unsignedInteger('max_participants')->default(100);
            $table->unsignedInteger('registered_participants')->default(0);
            $table->string('format', 64)->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->timestamp('registration_deadline')->nullable();
            $table->text('description')->nullable();
            $table->text('rules')->nullable();
            $table->text('requirements')->nullable();
            $table->string('stream_url')->nullable();
            $table->string('contact_email')->nullable();
            $table->string('image')->nullable();
            $table->unsignedInteger('first_prize_fcfa')->default(0);
            $table->unsignedInteger('second_prize_fcfa')->default(0);
            $table->unsignedInteger('third_prize_fcfa')->default(0);
            $table->json('sponsors')->nullable();
            $table->timestamps();

            $table->index(['is_active', 'status']);
            $table->index('starts_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tournaments');
    }
};
