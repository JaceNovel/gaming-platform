<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seller_kyc_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_id')->constrained('sellers')->onDelete('cascade');

            $table->enum('type', ['id_front', 'selfie']);
            $table->enum('source', ['upload', 'camera'])->default('upload');

            $table->string('disk', 32)->default('local');
            $table->string('path');
            $table->string('mime', 100)->nullable();
            $table->unsignedBigInteger('size')->nullable();
            $table->string('sha256', 64)->nullable();

            $table->timestamps();

            $table->unique(['seller_id', 'type']);
            $table->index(['seller_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seller_kyc_files');
    }
};
