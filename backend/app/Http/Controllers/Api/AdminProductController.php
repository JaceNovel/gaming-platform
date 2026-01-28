<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductTag;
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
            'display_section' => 'nullable|string|in:popular,cosmic_promo,latest,gaming_accounts',
            'delivery_eta_days' => 'nullable|integer|min:1',
            'stock' => 'required|integer|min:0',
            'price_fcfa' => 'nullable|integer|min:0',
            'is_active' => 'sometimes|boolean',
            'details' => 'nullable|array',
            'description' => 'nullable|string',
            'image_url' => 'nullable|url',
            'banner_url' => 'nullable|url',
            'mobile_section' => 'nullable|string|in:bundle,deal,for_you',
            'server_tags' => 'nullable|string',
            'images' => 'nullable|array|max:10',
            'images.*' => 'nullable|string|max:2048',
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

        $imageUrl = $data['image_url'] ?? null;
        $bannerUrl = $data['banner_url'] ?? null;
        $mobileSection = $data['mobile_section'] ?? null;
        unset($data['image_url'], $data['banner_url']);

        $details = is_array($data['details'] ?? null) ? $data['details'] : [];
        if ($imageUrl) {
            $details['image'] = $imageUrl;
        }
        if ($bannerUrl) {
            $details['banner'] = $bannerUrl;
            $details['cover'] = $bannerUrl;
        }
        if ($mobileSection) {
            $details['mobile_section'] = $mobileSection;
        }
        if (!empty($details)) {
            $data['details'] = $details;
        }

        if ($mobileSection === 'deal' && empty($data['display_section'])) {
            $data['display_section'] = 'popular';
        }

        $product = Product::create($data);

        $this->syncServerTags($product, $request->input('server_tags'));

        if ($product->type === 'account' && $request->has('images')) {
            $this->syncProductImages($product, $request->input('images'));
        }

        return response()->json($product->load(['images', 'tags']), 201);
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
            'display_section' => 'nullable|string|in:popular,cosmic_promo,latest,gaming_accounts',
            'delivery_eta_days' => 'nullable|integer|min:1',
            'stock' => 'sometimes|integer|min:0',
            'price_fcfa' => 'nullable|integer|min:0',
            'is_active' => 'sometimes|boolean',
            'details' => 'nullable|array',
            'description' => 'nullable|string',
            'image_url' => 'nullable|url',
            'banner_url' => 'nullable|url',
            'mobile_section' => 'nullable|string|in:bundle,deal,for_you',
            'server_tags' => 'nullable|string',
            'images' => 'nullable|array|max:10',
            'images.*' => 'nullable|string|max:2048',
        ]);

        $imageUrl = $data['image_url'] ?? null;
        $bannerUrl = $data['banner_url'] ?? null;
        $mobileSection = $data['mobile_section'] ?? null;
        unset($data['image_url'], $data['banner_url']);

        $details = is_array($data['details'] ?? null) ? $data['details'] : [];
        if ($imageUrl) {
            $details['image'] = $imageUrl;
        }
        if ($bannerUrl) {
            $details['banner'] = $bannerUrl;
            $details['cover'] = $bannerUrl;
        }
        if ($mobileSection) {
            $details['mobile_section'] = $mobileSection;
        }
        if (!empty($details)) {
            $data['details'] = $details;
        }

        if ($mobileSection === 'deal' && empty($data['display_section'])) {
            $data['display_section'] = 'popular';
        }

        $this->syncCategoryName($data);

        if (array_key_exists('shipping_required', $data) && $data['shipping_required']) {
            $deliveryType = $data['delivery_type'] ?? ($product->delivery_type ?? 'in_stock');
            $data['delivery_type'] = $deliveryType;
            if (empty($data['delivery_eta_days'])) {
                $data['delivery_eta_days'] = $deliveryType === 'preorder' ? 14 : 2;
            }
        }

        $typeChangedToNonAccount = array_key_exists('type', $data)
            && strtolower((string) $data['type']) !== 'account'
            && strtolower((string) $product->type) === 'account';

        $product->update($data);

        if ($request->has('server_tags')) {
            $this->syncServerTags($product, $request->input('server_tags'));
        }

        if ($typeChangedToNonAccount) {
            ProductImage::where('product_id', $product->id)->delete();
        } elseif (strtolower((string) $product->type) === 'account' && $request->has('images')) {
            $this->syncProductImages($product, $request->input('images'));
        }

        return response()->json($product->load(['images', 'tags']));
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
            'position' => 'sometimes|integer|min:1|max:50',
        ]);

        $path = $data['image']->store('products', 'public');
        $url = Storage::disk('public')->url($path);

        $nextPosition = (int) (ProductImage::where('product_id', $product->id)->max('position') ?? 0) + 1;
        $position = (int) ($data['position'] ?? $nextPosition);

        $image = ProductImage::create([
            'product_id' => $product->id,
            'url' => $url,
            'position' => $position,
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

    private function syncServerTags(Product $product, ?string $rawTags): void
    {
        $raw = trim((string) ($rawTags ?? ''));
        if ($raw === '') {
            $product->tags()->sync([]);
            return;
        }

        $names = collect(preg_split('/[,;\n]+/', $raw) ?: [])
            ->map(fn ($t) => trim((string) $t))
            ->filter();

        $tagIds = [];

        foreach ($names as $name) {
            $slug = str($name)->slug()->value();
            if (!$slug) {
                continue;
            }

            $tag = ProductTag::firstOrCreate(
                ['slug' => $slug],
                ['name' => $name, 'is_active' => true]
            );

            if (!$tag->is_active) {
                $tag->is_active = true;
                $tag->save();
            }

            $tagIds[] = $tag->id;
        }

        $product->tags()->sync(array_values(array_unique($tagIds)));
    }

    private function syncProductImages(Product $product, $images): void
    {
        if (strtolower((string) $product->type) !== 'account') {
            return;
        }

        $list = is_array($images) ? $images : [];
        $normalized = collect($list)
            ->map(fn ($value) => trim((string) $value))
            ->filter()
            ->values();

        ProductImage::where('product_id', $product->id)->delete();

        foreach ($normalized as $idx => $url) {
            ProductImage::create([
                'product_id' => $product->id,
                'url' => $url,
                'position' => (int) $idx,
            ]);
        }
    }
}
