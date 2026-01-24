<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Like;
use App\Models\Product;
use Illuminate\Http\Request;

class LikeController extends Controller
{
    public function toggle(Request $request)
    {
        $data = $request->validate([
            'product_id' => 'required|exists:products,id',
        ]);

        $user = $request->user();
        $productId = (int) $data['product_id'];

        $existing = Like::where('user_id', $user->id)
            ->where('product_id', $productId)
            ->first();

        if ($existing) {
            $existing->delete();
            $liked = false;
        } else {
            Like::create([
                'user_id' => $user->id,
                'product_id' => $productId,
            ]);
            $liked = true;
        }

        $likesCount = Like::where('product_id', $productId)->count();

        return response()->json([
            'liked' => $liked,
            'likes_count' => $likesCount,
        ]);
    }

    public function stats()
    {
        $totalLikes = Like::count();
        $topProducts = Product::withCount('likes')
            ->orderByDesc('likes_count')
            ->limit(5)
            ->get(['id', 'name'])
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'name' => $product->name,
                'likes' => $product->likes_count,
            ]);

        return response()->json([
            'total_likes' => $totalLikes,
            'top_products' => $topProducts,
        ]);
    }
}
