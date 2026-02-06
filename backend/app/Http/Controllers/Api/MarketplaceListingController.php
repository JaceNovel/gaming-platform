<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Seller;
use App\Models\SellerListing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
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
            ->where('status', 'approved')
            ->whereNull('order_id')
            ->whereNull('sold_at')
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

        if (!$sellerListing->isPubliclyVisible() || $sellerListing->seller?->status !== 'approved' || $sellerListing->seller?->partner_wallet_frozen) {
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
            'title' => ['required', 'string', 'max:140'],
            'description' => ['nullable', 'string', 'max:5000'],
            'image' => ['nullable', 'file', 'mimes:jpeg,jpg,png', 'max:5120'],
            'price' => ['required', 'numeric', 'min:1'],
            'accountLevel' => ['nullable', 'string', 'max:64'],
            'accountRank' => ['nullable', 'string', 'max:64'],
            'accountRegion' => ['nullable', 'string', 'max:64'],
            'hasEmailAccess' => ['nullable', 'boolean'],
        ]);

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = Storage::disk('public')->putFile('seller-listings', $request->file('image'));
        }

        $listing = SellerListing::create([
            'seller_id' => $seller->id,
            'game_id' => $data['gameId'] ?? null,
            // Marketplace listings are restricted to the "Compte Gaming" catalog.
            'category_id' => null,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'image_path' => $imagePath,
            'price' => $data['price'],
            'currency' => 'FCFA',
            'account_level' => $data['accountLevel'] ?? null,
            'account_rank' => $data['accountRank'] ?? null,
            'account_region' => $data['accountRegion'] ?? null,
            'has_email_access' => (bool) ($data['hasEmailAccess'] ?? false),
            // Always 24H.
            'delivery_window_hours' => 24,
            'status' => 'pending_review',
            'submitted_at' => now(),
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
            'title' => ['sometimes', 'required', 'string', 'max:140'],
            'description' => ['nullable', 'string', 'max:5000'],
            'image' => ['nullable', 'file', 'mimes:jpeg,jpg,png', 'max:5120'],
            'price' => ['sometimes', 'required', 'numeric', 'min:1'],
            'accountLevel' => ['nullable', 'string', 'max:64'],
            'accountRank' => ['nullable', 'string', 'max:64'],
            'accountRegion' => ['nullable', 'string', 'max:64'],
            'hasEmailAccess' => ['nullable', 'boolean'],
        ]);

        $map = [];
        if (array_key_exists('gameId', $data)) $map['game_id'] = $data['gameId'];
        if (array_key_exists('title', $data)) $map['title'] = $data['title'];
        if (array_key_exists('description', $data)) $map['description'] = $data['description'];
        if (array_key_exists('price', $data)) $map['price'] = $data['price'];
        if (array_key_exists('accountLevel', $data)) $map['account_level'] = $data['accountLevel'];
        if (array_key_exists('accountRank', $data)) $map['account_rank'] = $data['accountRank'];
        if (array_key_exists('accountRegion', $data)) $map['account_region'] = $data['accountRegion'];
        if (array_key_exists('hasEmailAccess', $data)) $map['has_email_access'] = (bool) $data['hasEmailAccess'];

        // Always 24H.
        $map['delivery_window_hours'] = 24;

        if ($request->hasFile('image')) {
            $old = $sellerListing->image_path;
            $map['image_path'] = Storage::disk('public')->putFile('seller-listings', $request->file('image'));
            if ($old) {
                try {
                    Storage::disk('public')->delete($old);
                } catch (\Throwable $e) {
                }
            }
        }

        $sellerListing->update($map);

        // If a previously approved listing is edited, it must go back through review.
        if (in_array($sellerListing->status, ['approved', 'rejected', 'draft'], true)) {
            $sellerListing->status = $sellerListing->status === 'approved' ? 'pending_review_update' : 'pending_review';
            $sellerListing->status_reason = null;
            $sellerListing->submitted_at = now();
            $sellerListing->reviewed_at = null;
            $sellerListing->reviewed_by = null;
            $sellerListing->approved_at = null;
            $sellerListing->rejected_at = null;
            $sellerListing->suspended_at = null;
            $sellerListing->save();
        }

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
            // Backward compatible: "active" means "submit for review".
            'status' => ['required', 'in:active,disabled'],
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        if ($data['status'] === 'active') {
            if (!$seller->canSell()) {
                return response()->json(['message' => 'Seller is not allowed to submit listings.'], 403);
            }
            $sellerListing->status = 'pending_review';
            $sellerListing->status_reason = null;
            $sellerListing->submitted_at = now();
        } else {
            // "disabled" becomes a seller draft.
            $sellerListing->status = 'draft';
            $sellerListing->status_reason = $data['reason'] ?? null;
        }
        $sellerListing->save();

        return response()->json(['ok' => true, 'data' => $sellerListing]);
    }
}
