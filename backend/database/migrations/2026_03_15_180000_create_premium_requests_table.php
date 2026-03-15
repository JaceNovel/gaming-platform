<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('premium_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->enum('level', ['bronze', 'platine']);
            $table->enum('status', ['pending', 'approved', 'refused'])->default('pending');
            $table->string('social_platform')->nullable();
            $table->string('social_handle')->nullable();
            $table->string('social_url')->nullable();
            $table->unsignedInteger('followers_count')->default(0);
            $table->json('other_platforms')->nullable();
            $table->text('motivation')->nullable();
            $table->json('promotion_channels')->nullable();
            $table->text('admin_note')->nullable();
            $table->json('rejection_reasons')->nullable();
            $table->boolean('send_refusal_email')->default(false);
            $table->foreignId('processed_by_admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('processed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('refused_at')->nullable();
            $table->string('conditions_pdf_path')->nullable();
            $table->string('certificate_pdf_path')->nullable();
            $table->string('refusal_pdf_path')->nullable();
            $table->timestamp('decision_email_sent_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'level']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('premium_requests');
    }
};