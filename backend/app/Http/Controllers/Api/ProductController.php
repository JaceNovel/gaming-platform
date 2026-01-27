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
        $query = Product::query()
            ->with(['game', 'images', 'categoryEntity'])
            ->withCount('likes');

        if ($request->boolean('active', true)) {
            $query->where('is_active', true);
        }

        if ($gameId = $request->input('game_id')) {
            $query->where('game_id', $gameId);
        }

        if ($type = $request->input('type')) {
            $query->where('type', $type);
        }

        if ($category = $request->input('category')) {
            $query->where(function ($inner) use ($category) {
                $inner->where('category', $category);

                if (is_numeric($category)) {
                    $inner->orWhere('category_id', (int) $category);
                } else {
                    $inner->orWhereHas('categoryEntity', function ($builder) use ($category) {
                        $builder->where('slug', $category)
                            ->orWhere('name', $category);
                    });
                }
            });
        }

        if ($dealType = $request->input('dealType')) {
            $query->where('deal_type', $dealType);
        }

        if ($section = $request->input('display_section')) {
            $query->where('display_section', $section);
        }

        if ($search = $request->input('q')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('title', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        $sort = $request->input('sort');
        if ($sort === 'popular') {
            $query->orderByDesc('likes_count')->orderByDesc('sold_count');
        } else {
            $query->orderByDesc('created_at');
        }

        if ($limit = $request->integer('limit')) {
            $products = $query->limit(min($limit, 100))->get();
            return response()->json(['data' => $products]);
        }

        $perPage = $request->integer('per_page', 20);
        $perPage = max(1, min($perPage, 100));
        $products = $query->paginate($perPage);

        return response()->json($products);
    }

    public function show(string $product)
    {
        $item = Product::with(['game', 'images', 'categoryEntity'])->withCount('likes')
            ->where('id', $product)
            ->orWhere('slug', $product)
            ->firstOrFail();

        return response()->json($item);
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
