<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Like;
use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::query()->with('game')->withCount('likes');

        if ($request->boolean('active', true)) {
            $query->where('is_active', true);
        }

        if ($gameId = $request->input('game_id')) {
            $query->where('game_id', $gameId);
        }

        if ($type = $request->input('type')) {
            $query->where('type', $type);
        }

        if ($search = $request->input('q')) {
            $query->where('name', 'like', "%{$search}%");
        }

        $products = $query->orderByDesc('created_at')->paginate(20);

        return response()->json($products);
    }

    public function show(Product $product)
    {
        $product->load('game')->loadCount('likes');
        return response()->json($product);
    }

    public function like(Request $request, Product $product)
    {
        $user = $request->user();

        $existing = Like::where('user_id', $user->id)
            ->where('product_id', $product->id)
            ->first();

        if ($existing) {
            $existing->delete();
            $liked = false;
        } else {
            Like::create([
                'user_id' => $user->id,
                'product_id' => $product->id,
            ]);
            $liked = true;
        }

        $likesCount = Like::where('product_id', $product->id)->count();

        return response()->json([
            'liked' => $liked,
            'likes_count' => $likesCount,
        ]);
    }
}
