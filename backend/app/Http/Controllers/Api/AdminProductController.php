<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\Request;

class AdminProductController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'game_id' => 'required|exists:games,id',
            'name' => 'required|string|max:255',
            'title' => 'nullable|string|max:255',
            'slug' => 'nullable|string|max:255',
            'type' => 'required|string|in:account,recharge,item',
            'category' => 'nullable|string|max:32',
            'category_id' => 'nullable|exists:categories,id',
            'price' => 'required|numeric|min:0',
            'discount_price' => 'nullable|numeric|min:0',
            'old_price' => 'nullable|numeric|min:0',
            'deal_type' => 'nullable|string|max:16',
            'stock_type' => 'nullable|string|max:16',
            'delivery_eta_days' => 'nullable|integer|min:1',
            'stock' => 'required|integer|min:0',
            'is_active' => 'sometimes|boolean',
            'details' => 'nullable|array',
            'description' => 'nullable|string',
        ]);

        $data['sku'] = $data['sku'] ?? $this->generateSku();
        $data['title'] = $data['title'] ?? $data['name'];
        $data['slug'] = $data['slug'] ?? str($data['title'])->slug()->value();
        $this->syncCategoryName($data);

        $product = Product::create($data);

        return response()->json($product, 201);
    }

    public function update(Request $request, Product $product)
    {
        $data = $request->validate([
            'game_id' => 'sometimes|exists:games,id',
            'name' => 'sometimes|string|max:255',
            'title' => 'sometimes|string|max:255',
            'slug' => 'sometimes|string|max:255',
            'type' => 'sometimes|string|in:account,recharge,item',
            'category' => 'nullable|string|max:32',
            'category_id' => 'nullable|exists:categories,id',
            'price' => 'sometimes|numeric|min:0',
            'discount_price' => 'nullable|numeric|min:0',
            'old_price' => 'nullable|numeric|min:0',
            'deal_type' => 'nullable|string|max:16',
            'stock_type' => 'nullable|string|max:16',
            'delivery_eta_days' => 'nullable|integer|min:1',
            'stock' => 'sometimes|integer|min:0',
            'is_active' => 'sometimes|boolean',
            'details' => 'nullable|array',
            'description' => 'nullable|string',
        ]);

        $this->syncCategoryName($data);

        $product->update($data);

        return response()->json($product);
    }

    public function destroy(Product $product)
    {
        $product->delete();

        return response()->json(['message' => 'Product deleted']);
    }

    private function generateSku(): string
    {
        $next = Product::count() + 1;
        return sprintf('BBS-%06d', $next);
    }

    private function syncCategoryName(array &$data): void
    {
        if (!array_key_exists('category_id', $data) || !$data['category_id']) {
            return;
        }

        $category = Category::find($data['category_id']);
        if ($category) {
            $data['category'] = $category->name;
        }
    }
}
