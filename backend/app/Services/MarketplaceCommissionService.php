<?php

namespace App\Services;

use App\Models\MarketplaceCommissionRule;

class MarketplaceCommissionService
{
    public function resolveCommissionForListing(?int $categoryId, float $price): float
    {
        // Commission has been disabled by default.
        // If you want to re-enable it, configure MarketplaceCommissionRule rows.

        // 1) Category override
        if ($categoryId) {
            $rule = MarketplaceCommissionRule::query()
                ->where('category_id', $categoryId)
                ->first();
            if ($rule) {
                return $rule->computeCommission($price);
            }
        }

        // 2) Global default rule
        $global = MarketplaceCommissionRule::query()
            ->whereNull('category_id')
            ->first();

        if ($global) {
            return $global->computeCommission($price);
        }

        // 3) Hard default (legacy was 400 FCFA)
        return 0.0;
    }
}
