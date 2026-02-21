<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $table) {
            $table->boolean('planning_enabled')->default(false)->after('is_active');
            $table->timestamp('first_match_at')->nullable()->after('registration_deadline');
            $table->text('reward_rules')->nullable()->after('requirements');
            $table->text('planning_notes')->nullable()->after('reward_rules');
        });

        Schema::table('tournament_registrations', function (Blueprint $table) {
            $table->string('game_player_id', 120)->nullable()->after('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('tournament_registrations', function (Blueprint $table) {
            $table->dropColumn('game_player_id');
        });

        Schema::table('tournaments', function (Blueprint $table) {
            $table->dropColumn(['planning_enabled', 'first_match_at', 'reward_rules', 'planning_notes']);
        });
    }
};
