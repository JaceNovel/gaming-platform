<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supplier_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('platform', 32);
            $table->string('label');
            $table->string('member_id')->nullable();
            $table->string('resource_owner')->nullable();
            $table->string('app_key')->nullable();
            $table->text('app_secret')->nullable();
            $table->text('access_token')->nullable();
            $table->text('refresh_token')->nullable();
            $table->timestamp('access_token_expires_at')->nullable();
            $table->timestamp('refresh_token_expires_at')->nullable();
            $table->json('scopes_json')->nullable();
            $table->string('country_code', 8)->nullable();
            $table->string('currency_code', 8)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_sync_at')->nullable();
            $table->timestamp('last_error_at')->nullable();
            $table->text('last_error_message')->nullable();
            $table->timestamps();

            $table->index(['platform', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_accounts');
    }
};