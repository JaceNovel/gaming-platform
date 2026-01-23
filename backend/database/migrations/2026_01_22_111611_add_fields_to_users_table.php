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
        Schema::table('users', function (Blueprint $table) {
            $table->string('game_username')->nullable()->after('name');
            $table->boolean('is_premium')->default(false)->after('email');
            $table->enum('premium_level', ['bronze', 'or', 'platine'])->nullable()->after('is_premium');
            $table->date('premium_expiration')->nullable()->after('premium_level');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['game_username', 'is_premium', 'premium_level', 'premium_expiration']);
        });
    }
};
