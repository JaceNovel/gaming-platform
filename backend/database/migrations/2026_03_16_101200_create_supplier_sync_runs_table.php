<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supplier_sync_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('supplier_account_id')->nullable()->constrained()->nullOnDelete();
            $table->string('job_type', 32);
            $table->string('status', 24)->default('running');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->json('meta_json')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index(['supplier_account_id', 'job_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_sync_runs');
    }
};