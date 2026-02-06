<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Like;
use App\Models\Order;
use App\Models\PremiumMembership;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class PublicStatsController extends Controller
{
    public function home()
    {
        $baseAccountsSold = 67;
        $baseRechargesDone = 40;
        $basePremiumMembers = 6;
        $baseGuidesActive = 25;

        $paidStatus = Order::STATUS_PAYMENT_SUCCESS;

        $accountsSold = (int) DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->where('orders.status', $paidStatus)
            ->where('products.type', 'account')
            ->sum('order_items.quantity');

        $rechargesDone = (int) DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->where('orders.status', $paidStatus)
            ->where('products.type', 'recharge')
            ->sum('order_items.quantity');

        $premiumMembers = (int) PremiumMembership::where('is_active', true)
            ->whereDate('expiration_date', '>=', Carbon::today())
            ->count();

        $guidesActive = (int) User::count();

        $accountsSold += $baseAccountsSold;
        $rechargesDone += $baseRechargesDone;
        $premiumMembers += $basePremiumMembers;
        $guidesActive += $baseGuidesActive;

        return response()->json([
            'accounts_sold' => $accountsSold,
            'recharges_done' => $rechargesDone,
            'premium_members' => $premiumMembers,
            'guides_active' => $guidesActive,
        ]);
    }

    public function overview()
    {
        $totalLikes = Like::count();
        $totalUsers = User::count();
        $totalOrders = Order::count();
        $premiumUsers = User::where('is_premium', true)->count();

        return response()->json([
            'likes' => $totalLikes,
            'users' => $totalUsers,
            'orders' => $totalOrders,
            'premium' => $premiumUsers,
        ]);
    }
}
