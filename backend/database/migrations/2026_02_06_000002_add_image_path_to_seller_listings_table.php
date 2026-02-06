<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('seller_listings', function (Blueprint $table) {
            if (!Schema::hasColumn('seller_listings', 'image_path')) {
                $table->string('image_path', 255)->nullable()->after('description');
            }
        });
    }

    public function down(): void
    {
        Schema::table('seller_listings', function (Blueprint $table) {
            if (Schema::hasColumn('seller_listings', 'image_path')) {
                $table->dropColumn('image_path');
            }
        });
    }
};
