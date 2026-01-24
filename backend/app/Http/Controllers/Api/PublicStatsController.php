<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Like;
use App\Models\Order;
use App\Models\User;

class PublicStatsController extends Controller
{
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
