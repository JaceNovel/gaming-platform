<?php

namespace App\Services;

use App\Models\MarketplaceOrder;
use App\Models\Seller;
use Illuminate\Support\Carbon;

class SellerSalesLimitService
{
    public const NON_VIP_MONTHLY_LIMIT = 80000.0;

    private const ELIGIBLE_STATUSES = ['paid', 'delivered', 'disputed', 'resolved_release'];

    public function monthlySalesForSeller(Seller $seller, ?Carbon $referenceDate = null): float
    {
        $reference = $referenceDate ?: now();
        $start = $reference->copy()->startOfMonth();
        $end = $reference->copy()->endOfMonth();

        $sum = MarketplaceOrder::query()
            ->where('seller_id', $seller->id)
            ->whereIn('status', self::ELIGIBLE_STATUSES)
            ->whereBetween('created_at', [$start, $end])
            ->sum('price');

        $value = (float) $sum;
        return is_finite($value) ? max(0.0, $value) : 0.0;
    }

    public function isVipSeller(Seller $seller): bool
    {
        $seller->loadMissing('user');
        return (bool) ($seller->user?->is_premium);
    }

    public function requiresVipUpgrade(Seller $seller): bool
    {
        if ($this->isVipSeller($seller)) {
            return false;
        }

        return $this->monthlySalesForSeller($seller) >= self::NON_VIP_MONTHLY_LIMIT;
    }

    public function limitMessage(): string
    {
        return 'Limite mensuelle de 80 000 FCFA atteinte. Passe VIP pour continuer à vendre.';
    }
}
