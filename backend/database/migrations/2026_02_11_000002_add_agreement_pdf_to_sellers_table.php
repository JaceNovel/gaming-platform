<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sellers', function (Blueprint $table) {
            $table->string('agreement_pdf_path')->nullable()->after('partner_wallet_frozen_at');
            $table->timestamp('agreement_pdf_generated_at')->nullable()->after('agreement_pdf_path');
        });
    }

    public function down(): void
    {
        Schema::table('sellers', function (Blueprint $table) {
            $table->dropColumn(['agreement_pdf_generated_at', 'agreement_pdf_path']);
        });
    }
};
