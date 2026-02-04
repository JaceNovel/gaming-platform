<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Seller;
use App\Models\SellerListing;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class MarketplaceListingController extends Controller
{
    private function trustForListing(SellerListing $listing): array
    {
        $seller = $listing->seller;
        $stats = $seller?->stats;

        $totalSales = (int) ($stats?->total_sales ?? 0);
        $successfulSales = (int) ($stats?->successful_sales ?? 0);
        $disputedSales = (int) ($stats?->disputed_sales ?? 0);

        $successRate = $totalSales > 0 ? round($successfulSales / $totalSales, 4) : 0.0;

        $badges = [];
        if ($seller && $seller->status === 'approved') {
            $badges[] = 'verified';
        }
        if ($totalSales === 0) {
            $badges[] = 'new';
        }
        if (($seller && $seller->partner_wallet_frozen) || $disputedSales > 0) {
            $badges[] = 'under_surveillance';
        }

        return [
            'totalSales' => $totalSales,
            'successRate' => $successRate,
            'badges' => $badges,
        ];
    }

    public function index(Request $request)
    {
        $q = SellerListing::query()
            ->with(['game', 'category', 'seller.stats'])
            ->where('status', 'active')
            ->where(function ($sub) {
                $sub->whereNull('reserved_until')->orWhere('reserved_until', '<', now());
            })
            ->whereHas('seller', function ($sq) {
                $sq->where('status', 'approved')->where('partner_wallet_frozen', false);
            });

        if ($request->filled('gameId')) {
            $q->where('game_id', $request->integer('gameId'));
        }

        if ($request->filled('categoryId')) {
            $q->where('category_id', $request->integer('categoryId'));
        }

        $listings = $q->orderByDesc('created_at')->paginate(20);

        $listings->getCollection()->transform(function (SellerListing $listing) {
            $listing->setAttribute('seller_trust', $this->trustForListing($listing));
            return $listing;
        });

        return response()->json(['data' => $listings]);
    }

    public function showPublic(SellerListing $sellerListing)
    {
        $sellerListing->load(['game', 'category', 'seller.stats']);

        if ($sellerListing->status !== 'active' || $sellerListing->seller?->status !== 'approved' || $sellerListing->seller?->partner_wallet_frozen) {
            return response()->json(['message' => 'Listing not available.'], 404);
        }

        $sellerListing->setAttribute('seller_trust', $this->trustForListing($sellerListing));

        return response()->json(['data' => $sellerListing]);
    }

    public function mine(Request $request)
    {
        $seller = Seller::query()->where('user_id', $request->user()->id)->firstOrFail();

        $listings = SellerListing::query()
            ->with(['game', 'category'])
            ->where('seller_id', $seller->id)
            ->orderByDesc('created_at')
            ->paginate(30);

        return response()->json(['data' => $listings]);
    }

    public function store(Request $request)
    {
        $seller = Seller::query()->where('user_id', $request->user()->id)->firstOrFail();

        if (!$seller->canSell()) {
            return response()->json(['message' => 'Seller is not allowed to create listings.'], 403);
        }

        $data = $request->validate([
            'gameId' => ['nullable', 'integer', 'exists:games,id'],
            'categoryId' => ['nullable', 'integer', 'exists:categories,id'],
            'title' => ['required', 'string', 'max:140'],
            'description' => ['nullable', 'string', 'max:5000'],
            'price' => ['required', 'numeric', 'min:1'],
            'accountLevel' => ['nullable', 'string', 'max:64'],
            'accountRank' => ['nullable', 'string', 'max:64'],
            'accountRegion' => ['nullable', 'string', 'max:64'],
            'hasEmailAccess' => ['nullable', 'boolean'],
            'deliveryWindowHours' => ['nullable', 'integer', 'min:1', 'max:168'],
        ]);

        $listing = SellerListing::create([
            'seller_id' => $seller->id,
            'game_id' => $data['gameId'] ?? null,
            'category_id' => $data['categoryId'] ?? null,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'price' => $data['price'],
            'currency' => 'FCFA',
            'account_level' => $data['accountLevel'] ?? null,
            'account_rank' => $data['accountRank'] ?? null,
            'account_region' => $data['accountRegion'] ?? null,
            'has_email_access' => (bool) ($data['hasEmailAccess'] ?? false),
            'delivery_window_hours' => $data['deliveryWindowHours'] ?? 24,
            'status' => 'active',
        ]);

        return response()->json(['data' => $listing], 201);
    }

    public function update(Request $request, SellerListing $sellerListing)
    {
        $seller = Seller::query()->where('user_id', $request->user()->id)->firstOrFail();

        if ((int) $sellerListing->seller_id !== (int) $seller->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($sellerListing->status === 'sold') {
            throw ValidationException::withMessages([
                'status' => ['Sold listings cannot be edited.'],
            ]);
        }

        $data = $request->validate([
            'gameId' => ['nullable', 'integer', 'exists:games,id'],
            'categoryId' => ['nullable', 'integer', 'exists:categories,id'],
            'title' => ['sometimes', 'required', 'string', 'max:140'],
            'description' => ['nullable', 'string', 'max:5000'],
            'price' => ['sometimes', 'required', 'numeric', 'min:1'],
            'accountLevel' => ['nullable', 'string', 'max:64'],
            'accountRank' => ['nullable', 'string', 'max:64'],
            'accountRegion' => ['nullable', 'string', 'max:64'],
            'hasEmailAccess' => ['nullable', 'boolean'],
            'deliveryWindowHours' => ['nullable', 'integer', 'min:1', 'max:168'],
        ]);

        $map = [];
        if (array_key_exists('gameId', $data)) $map['game_id'] = $data['gameId'];
        if (array_key_exists('categoryId', $data)) $map['category_id'] = $data['categoryId'];
        if (array_key_exists('title', $data)) $map['title'] = $data['title'];
        if (array_key_exists('description', $data)) $map['description'] = $data['description'];
        if (array_key_exists('price', $data)) $map['price'] = $data['price'];
        if (array_key_exists('accountLevel', $data)) $map['account_level'] = $data['accountLevel'];
        if (array_key_exists('accountRank', $data)) $map['account_rank'] = $data['accountRank'];
        if (array_key_exists('accountRegion', $data)) $map['account_region'] = $data['accountRegion'];
        if (array_key_exists('hasEmailAccess', $data)) $map['has_email_access'] = (bool) $data['hasEmailAccess'];
        if (array_key_exists('deliveryWindowHours', $data)) $map['delivery_window_hours'] = $data['deliveryWindowHours'];

        $sellerListing->update($map);

        return response()->json(['data' => $sellerListing]);
    }

    public function setStatus(Request $request, SellerListing $sellerListing)
    {
        $seller = Seller::query()->where('user_id', $request->user()->id)->firstOrFail();

        if ((int) $sellerListing->seller_id !== (int) $seller->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($sellerListing->status === 'sold') {
            throw ValidationException::withMessages([
                'status' => ['Sold listings cannot be changed.'],
            ]);
        }

        $data = $request->validate([
            'status' => ['required', 'in:active,disabled'],
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        if ($data['status'] === 'active' && !$seller->canSell()) {
            return response()->json(['message' => 'Seller is not allowed to activate listings.'], 403);
        }

        $sellerListing->status = $data['status'];
        $sellerListing->status_reason = $data['status'] === 'disabled' ? ($data['reason'] ?? null) : null;
        $sellerListing->save();

        return response()->json(['ok' => true, 'data' => $sellerListing]);
    }
}
