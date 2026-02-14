<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sellers', function (Blueprint $table) {
            if (!Schema::hasColumn('sellers', 'company_name')) {
                $table->string('company_name', 120)->nullable()->after('whatsapp_number');
            }

            if (!Schema::hasColumn('sellers', 'terms_accepted_at')) {
                $table->timestamp('terms_accepted_at')->nullable()->after('kyc_submitted_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('sellers', function (Blueprint $table) {
            if (Schema::hasColumn('sellers', 'terms_accepted_at')) {
                $table->dropColumn('terms_accepted_at');
            }
            if (Schema::hasColumn('sellers', 'company_name')) {
                $table->dropColumn('company_name');
            }
        });
    }
};
