<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $patterns = [
            '%hub logistique principal%',
            '%hub logistique central%',
            '%tracking number sera communique%',
            '%Expedition apres atteinte du seuil minimum de commande pour votre zone%',
        ];

        DB::table('supplier_countries')
            ->where('platform', 'aliexpress')
            ->where(function ($query) use ($patterns) {
                foreach ($patterns as $pattern) {
                    $query->orWhere('customer_notice', 'like', $pattern);
                }
            })
            ->update([
                'customer_notice' => null,
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
    }
};