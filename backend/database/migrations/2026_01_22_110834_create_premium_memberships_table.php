<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('premium_memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->enum('level', ['bronze', 'or', 'platine']);
            $table->foreignId('game_id')->constrained()->onDelete('cascade');
            $table->string('game_username');
            $table->date('expiration_date');
            $table->boolean('is_active')->default(true);
            $table->integer('renewal_count')->default(0);
            $table->timestamps();
            $table->unique(['user_id', 'game_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('premium_memberships');
    }
};
