<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductTag;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AdminProductController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            // Most products are tied to a game; allow null only for generic catalog items (e.g. accessories).
            'game_id' => 'required_unless:type,item|nullable|exists:games,id',
            'name' => 'required|string|max:255',
            'title' => 'nullable|string|max:255',
            'slug' => 'nullable|string|max:255',
            'type' => 'required|string|in:account,recharge,item,subscription',
            'category' => 'nullable|string|max:32',
            'accessory_category' => 'nullable|string|max:32',
            'accessory_subcategory' => 'nullable|string|max:64',
            'accessory_stock_mode' => 'nullable|string|in:local,air,sea',
            'category_id' => 'nullable|exists:categories,id',
            'price' => 'required|numeric|min:0',
            'shipping_fee' => 'nullable|numeric|min:0',
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
            'display_section' => 'nullable|string|in:popular,emote_skin,cosmic_promo,latest,gaming_accounts,recharge_direct',
            'delivery_eta_days' => 'nullable|integer|min:1',
            'delivery_estimate_label' => 'nullable|string|max:64',
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
        $desiredSlug = array_key_exists('slug', $data) && $data['slug'] !== null
            ? (string) $data['slug']
            : (string) str($data['title'])->slug()->value();
        $data['slug'] = $this->generateUniqueProductSlug($desiredSlug);
        $this->syncCategoryName($data);

        // Only keep the admin delivery estimate label for "item" products (accessories).
        // Skins are also stored as type=item but are handled by the frontend via display_section.
        $type = strtolower((string) ($data['type'] ?? ''));
        if ($type !== 'item') {
            $data['delivery_estimate_label'] = null;
        }

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

        $product = null;
        for ($attempt = 1; $attempt <= 3; $attempt++) {
            try {
                $product = Product::create($data);
                break;
            } catch (QueryException $e) {
                $message = $e->getMessage();
                $sqlState = $e->errorInfo[0] ?? null;

                // Postgres: 23505 = unique_violation. MySQL: 23000.
                $isUniqueViolation = in_array($sqlState, ['23505', '23000'], true)
                    || str_contains($message, 'duplicate key')
                    || str_contains($message, 'Duplicate entry');

                $isSkuCollision = str_contains($message, 'products_sku_unique') || str_contains($message, 'sku');
                $isSlugCollision = str_contains($message, 'products_slug_unique') || str_contains($message, 'slug');

                if ($attempt < 3 && $isUniqueViolation && ($isSkuCollision || $isSlugCollision)) {
                    if ($isSkuCollision) {
                        $data['sku'] = $this->generateSku();
                    }
                    if ($isSlugCollision) {
                        $data['slug'] = $this->generateUniqueProductSlug((string) ($data['slug'] ?? 'product'));
                    }
                    continue;
                }

                Log::error('Admin product create failed', [
                    'path' => $request->path(),
                    'method' => $request->method(),
                    'user_id' => $request->user()?->id,
                    'request_id' => $request->headers->get('X-Request-ID')
                        ?? $request->headers->get('X-Request-Id')
                        ?? $request->headers->get('X-Correlation-ID')
                        ?? null,
                    'error' => $message,
                    'sql_state' => $sqlState,
                ]);

                throw ValidationException::withMessages([
                    'product' => 'Impossible de créer le produit (données invalides ou base non à jour).',
                ]);
            }
        }

        if (!$product) {
            throw ValidationException::withMessages([
                'product' => 'Impossible de créer le produit (réessayez).',
            ]);
        }

        try {
            $isActive = (bool) ($product->is_active ?? false);
            $type = strtolower((string) ($product->type ?? ''));
            // Notify only for new active "item" products (articles) to avoid spamming for internal catalog changes.
            if ($isActive && $type === 'item') {
                $title = (string) ($product->title ?? $product->name ?? '');
                $title = trim($title);
                if ($title !== '') {
                    app(NotificationService::class)->broadcast(
                        type: 'new_product',
                        message: "Nouveau produit ajouté : {$title}",
                    );
                }
            }
        } catch (\Throwable) {
            // best-effort
        }

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
            'accessory_category' => 'nullable|string|max:32',
            'accessory_subcategory' => 'nullable|string|max:64',
            'accessory_stock_mode' => 'nullable|string|in:local,air,sea',
            'category_id' => 'nullable|exists:categories,id',
            'price' => 'sometimes|numeric|min:0',
            'shipping_fee' => 'nullable|numeric|min:0',
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
            'display_section' => 'nullable|string|in:popular,emote_skin,cosmic_promo,latest,gaming_accounts,recharge_direct',
            'delivery_eta_days' => 'nullable|integer|min:1',
            'delivery_estimate_label' => 'nullable|string|max:64',
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

        if (array_key_exists('slug', $data) && $data['slug'] !== null) {
            $data['slug'] = $this->generateUniqueProductSlug((string) $data['slug'], $product->id);
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

        $this->syncCategoryName($data);

        if (array_key_exists('type', $data)) {
            $type = strtolower((string) ($data['type'] ?? ''));
            if ($type !== 'item') {
                $data['delivery_estimate_label'] = null;
            }
        }

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
        // Previous implementation used Product::count()+1, which can collide when rows are deleted
        // or when multiple admins create products concurrently.
        $max = 0;

        // Scan a window of recent SKUs to infer the current max.
        // Keeps this DB-agnostic (pgsql/mysql) and avoids slow full-table scans.
        $recentSkus = Product::query()
            ->whereNotNull('sku')
            ->orderByDesc('id')
            ->limit(2000)
            ->pluck('sku');

        foreach ($recentSkus as $sku) {
            $sku = (string) $sku;
            if (!str_starts_with($sku, 'BBS-')) {
                continue;
            }
            $num = (int) ltrim(substr($sku, 4), '0');
            if ($num > $max) {
                $max = $num;
            }
        }

        $next = max(1, $max + 1);

        // Guarantee uniqueness in-process.
        // Still not a perfect lock for concurrency, but drastically reduces collisions.
        for ($i = 0; $i < 50; $i++) {
            $candidate = sprintf('BBS-%06d', $next + $i);
            if (!Product::query()->where('sku', $candidate)->exists()) {
                return $candidate;
            }
        }

        // Last resort: time-based suffix.
        return 'BBS-' . now()->format('YmdHis');
    }

    private function generateUniqueProductSlug(string $desiredSlug, ?int $ignoreProductId = null): string
    {
        $base = str($desiredSlug)->slug()->value();
        if (!$base) {
            $base = 'product';
        }

        $slug = $base;
        $suffix = 1;

        while (
            Product::query()
                ->where('slug', $slug)
                ->when($ignoreProductId, fn ($q) => $q->where('id', '!=', $ignoreProductId))
                ->exists()
        ) {
            $suffix++;
            $slug = $base . '-' . $suffix;

            // Avoid pathological loops if the table has many collisions.
            if ($suffix > 200) {
                $slug = $base . '-' . now()->format('YmdHis');
                break;
            }
        }

        return $slug;
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
