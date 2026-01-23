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
            $table->string('country_code', 2)->nullable()->after('email');
            $table->string('country_name')->nullable()->after('country_code');
            $table->string('avatar_id', 64)->default('shadow_default')->after('country_name');
            $table->string('premium_tier', 24)->default('Bronze')->after('avatar_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['country_code', 'country_name', 'avatar_id', 'premium_tier']);
        });
    }
};
