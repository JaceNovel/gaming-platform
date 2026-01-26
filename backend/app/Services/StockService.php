<?php

namespace App\Services;

use App\Models\Product;
use App\Models\RedeemDenomination;
use App\Models\StockMovement;
use App\Models\User;

class StockService
{
    public function adjustProductStock(Product $product, int $quantity, string $reason, ?User $admin = null, array $meta = []): StockMovement
    {
        $product->increment('stock', $quantity);

        return StockMovement::create([
            'product_id' => $product->id,
            'quantity' => $quantity,
            'direction' => $quantity >= 0 ? 'in' : 'out',
            'reason' => $reason,
            'admin_id' => $admin?->id,
            'meta' => $meta,
        ]);
    }

    public function logRedeemImport(RedeemDenomination $denomination, int $quantity, ?User $admin = null, array $meta = []): StockMovement
    {
        return StockMovement::create([
            'redeem_denomination_id' => $denomination->id,
            'quantity' => $quantity,
            'direction' => 'in',
            'reason' => 'redeem_import',
            'admin_id' => $admin?->id,
            'meta' => $meta,
        ]);
    }
}
