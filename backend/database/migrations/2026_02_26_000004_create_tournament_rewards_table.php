<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tournament_rewards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tournament_id')->constrained('tournaments')->onDelete('cascade');
            $table->unsignedTinyInteger('place');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->unsignedInteger('reward_amount_fcfa')->default(0);
            $table->unsignedInteger('min_purchase_amount_fcfa')->default(0);
            $table->timestamp('credited_at')->nullable();
            $table->timestamps();

            $table->unique(['tournament_id', 'place']);
            $table->index(['tournament_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tournament_rewards');
    }
};
