<?php

namespace App\Services;

use App\Models\MarketplaceCommissionRule;

class MarketplaceCommissionService
{
    public function resolveCommissionForListing(?int $categoryId, float $price): float
    {
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

        // 3) Hard default (legacy requirement)
        return 400.0;
    }
}
