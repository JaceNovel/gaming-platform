<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('sku', 32)->nullable()->unique()->after('id');
            $table->string('title')->nullable()->after('name');
            $table->string('slug')->nullable()->unique()->after('title');
            $table->text('description')->nullable()->after('details');
            $table->string('category', 32)->nullable()->after('type');
            $table->decimal('old_price', 16, 2)->nullable()->after('discount_price');
            $table->integer('discount_percent')->default(0)->after('old_price');
            $table->string('deal_type', 16)->default('NONE')->after('category');
            $table->string('stock_type', 16)->default('IN_STOCK')->after('deal_type');
            $table->integer('delivery_eta_days')->default(2)->after('stock_type');
            $table->unsignedBigInteger('purchases_count')->default(0)->after('delivery_eta_days');
            $table->unsignedBigInteger('cart_adds_count')->default(0)->after('purchases_count');
            $table->decimal('rating_avg', 3, 2)->default(0)->after('cart_adds_count');
            $table->unsignedBigInteger('rating_count')->default(0)->after('rating_avg');
            $table->unsignedBigInteger('sold_count')->default(0)->after('rating_count');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'sku',
                'title',
                'slug',
                'description',
                'category',
                'old_price',
                'discount_percent',
                'deal_type',
                'stock_type',
                'delivery_eta_days',
                'purchases_count',
                'cart_adds_count',
                'rating_avg',
                'rating_count',
                'sold_count',
            ]);
        });
    }
};
