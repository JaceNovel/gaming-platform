<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AdminProductController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'game_id' => 'nullable|exists:games,id',
            'name' => 'required|string|max:255',
            'title' => 'nullable|string|max:255',
            'slug' => 'nullable|string|max:255',
            'type' => 'required|string|in:account,recharge,item,subscription',
            'category' => 'nullable|string|max:32',
            'category_id' => 'nullable|exists:categories,id',
            'price' => 'required|numeric|min:0',
            'discount_price' => 'nullable|numeric|min:0',
            'old_price' => 'nullable|numeric|min:0',
            'deal_type' => 'nullable|string|max:16',
            'stock_type' => 'nullable|string|max:16',
            'stock_mode' => 'nullable|string|max:32',
            'redeem_sku' => 'nullable|string|max:64',
            'redeem_code_delivery' => 'nullable|boolean',
            'stock_low_threshold' => 'nullable|integer|min:0',
            'stock_alert_channel' => 'nullable|string|max:20',
            'stock_alert_emails' => 'nullable|string',
            'shipping_required' => 'nullable|boolean',
            'delivery_type' => 'nullable|string|in:in_stock,preorder',
            'display_section' => 'nullable|string|in:popular,cosmic_promo,latest',
            'delivery_eta_days' => 'nullable|integer|min:1',
            'stock' => 'required|integer|min:0',
            'price_fcfa' => 'nullable|integer|min:0',
            'is_active' => 'sometimes|boolean',
            'details' => 'nullable|array',
            'description' => 'nullable|string',
        ]);

        $data['sku'] = $data['sku'] ?? $this->generateSku();
        $data['title'] = $data['title'] ?? $data['name'];
        $data['slug'] = $data['slug'] ?? str($data['title'])->slug()->value();
        $this->syncCategoryName($data);

        if (!empty($data['shipping_required'])) {
            $deliveryType = $data['delivery_type'] ?? 'in_stock';
            $data['delivery_type'] = $deliveryType;
            if (empty($data['delivery_eta_days'])) {
                $data['delivery_eta_days'] = $deliveryType === 'preorder' ? 14 : 2;
            }
        }

        $product = Product::create($data);

        return response()->json($product, 201);
    }

    public function update(Request $request, Product $product)
    {
        $data = $request->validate([
            'game_id' => 'sometimes|nullable|exists:games,id',
            'name' => 'sometimes|string|max:255',
            'title' => 'sometimes|string|max:255',
            'slug' => 'sometimes|string|max:255',
            'type' => 'sometimes|string|in:account,recharge,item,subscription',
            'category' => 'nullable|string|max:32',
            'category_id' => 'nullable|exists:categories,id',
            'price' => 'sometimes|numeric|min:0',
            'discount_price' => 'nullable|numeric|min:0',
            'old_price' => 'nullable|numeric|min:0',
            'deal_type' => 'nullable|string|max:16',
            'stock_type' => 'nullable|string|max:16',
            'stock_mode' => 'nullable|string|max:32',
            'redeem_sku' => 'nullable|string|max:64',
            'redeem_code_delivery' => 'nullable|boolean',
            'stock_low_threshold' => 'nullable|integer|min:0',
            'stock_alert_channel' => 'nullable|string|max:20',
            'stock_alert_emails' => 'nullable|string',
            'shipping_required' => 'nullable|boolean',
            'delivery_type' => 'nullable|string|in:in_stock,preorder',
            'display_section' => 'nullable|string|in:popular,cosmic_promo,latest',
            'delivery_eta_days' => 'nullable|integer|min:1',
            'stock' => 'sometimes|integer|min:0',
            'price_fcfa' => 'nullable|integer|min:0',
            'is_active' => 'sometimes|boolean',
            'details' => 'nullable|array',
            'description' => 'nullable|string',
        ]);

        $this->syncCategoryName($data);

        if (array_key_exists('shipping_required', $data) && $data['shipping_required']) {
            $deliveryType = $data['delivery_type'] ?? ($product->delivery_type ?? 'in_stock');
            $data['delivery_type'] = $deliveryType;
            if (empty($data['delivery_eta_days'])) {
                $data['delivery_eta_days'] = $deliveryType === 'preorder' ? 14 : 2;
            }
        }

        $product->update($data);

        return response()->json($product);
    }

    public function destroy(Product $product)
    {
        $product->delete();

        return response()->json(['message' => 'Product deleted']);
    }

    public function uploadImage(Request $request, Product $product)
    {
        $data = $request->validate([
            'image' => 'required|image|max:4096',
        ]);

        $path = $data['image']->store('products', 'public');
        $url = Storage::disk('public')->url($path);

        $image = ProductImage::create([
            'product_id' => $product->id,
            'url' => $url,
            'position' => 1,
        ]);

        return response()->json(['data' => $image], 201);
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
