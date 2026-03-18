<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('supplier_countries')
            ->where('platform', 'aliexpress')
            ->whereIn('code', ['BF', 'BJ', 'TG'])
            ->update([
                'customer_notice' => "⚠️ Expedition apres atteinte du seuil minimum de commande pour votre zone. Votre tracking number sera communique des l'expedition.",
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
    }
};