<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SellerListing;
use App\Services\AdminAuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminMarketplaceListingController extends Controller
{
    public function index(Request $request)
    {
        $q = SellerListing::query()->with(['seller.user', 'game', 'category']);

        if ($request->filled('status')) {
            $q->where('status', $request->string('status')->toString());
        }

        if ($request->filled('seller_id')) {
            $q->where('seller_id', $request->integer('seller_id'));
        }

        if ($request->filled('game_id')) {
            $q->where('game_id', $request->integer('game_id'));
        }

        if ($request->filled('search')) {
            $search = '%' . $request->string('search')->toString() . '%';
            $q->where(function ($sub) use ($search) {
                $sub->where('title', 'like', $search)
                    ->orWhere('description', 'like', $search)
                    ->orWhereHas('seller.user', function ($uq) use ($search) {
                        $uq->where('email', 'like', $search)->orWhere('name', 'like', $search);
                    });
            });
        }

        $perPage = (int) $request->integer('per_page', 30);

        $listings = $q->orderByDesc('updated_at')->paginate($perPage);

        return response()->json(['data' => $listings]);
    }

    public function show(SellerListing $sellerListing)
    {
        $sellerListing->load(['seller.user', 'game', 'category']);

        return response()->json(['data' => $sellerListing]);
    }

    public function approve(Request $request, SellerListing $sellerListing)
    {
        $admin = $request->user();

        DB::transaction(function () use ($sellerListing, $admin) {
            $listing = SellerListing::query()->lockForUpdate()->findOrFail($sellerListing->id);
            $listing->loadMissing('seller');

            if ($listing->order_id || $listing->sold_at) {
                throw ValidationException::withMessages([
                    'status' => ['Cannot approve a sold listing.'],
                ]);
            }

            $seller = $listing->seller;
            if (!$seller || !$seller->isApproved() || $seller->partner_wallet_frozen) {
                throw ValidationException::withMessages([
                    'seller' => ['Seller is not eligible to publish listings.'],
                ]);
            }

            $listing->status = 'approved';
            $listing->status_reason = null;
            $listing->reviewed_at = now();
            $listing->reviewed_by = $admin->id;
            $listing->approved_at = now();
            $listing->rejected_at = null;
            $listing->suspended_at = null;
            $listing->save();
        });

        try {
            /** @var AdminAuditLogger $audit */
            $audit = app(AdminAuditLogger::class);
            $audit->log($admin, 'marketplace.listing.approve', [
                'seller_listing_id' => $sellerListing->id,
            ], 'marketplace', $request);
        } catch (\Throwable $e) {
        }

        return response()->json(['ok' => true]);
    }

    public function reject(Request $request, SellerListing $sellerListing)
    {
        $admin = $request->user();

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($sellerListing, $admin, $data) {
            $listing = SellerListing::query()->lockForUpdate()->findOrFail($sellerListing->id);

            if ($listing->order_id || $listing->sold_at) {
                throw ValidationException::withMessages([
                    'status' => ['Cannot reject a sold listing.'],
                ]);
            }

            $listing->status = 'rejected';
            $listing->status_reason = $data['reason'];
            $listing->reviewed_at = now();
            $listing->reviewed_by = $admin->id;
            $listing->approved_at = null;
            $listing->rejected_at = now();
            $listing->suspended_at = null;
            $listing->reserved_order_id = null;
            $listing->reserved_until = null;
            $listing->save();
        });

        try {
            /** @var AdminAuditLogger $audit */
            $audit = app(AdminAuditLogger::class);
            $audit->log($admin, 'marketplace.listing.reject', [
                'seller_listing_id' => $sellerListing->id,
                'reason' => $data['reason'],
            ], 'marketplace', $request);
        } catch (\Throwable $e) {
        }

        return response()->json(['ok' => true]);
    }

    public function suspend(Request $request, SellerListing $sellerListing)
    {
        $admin = $request->user();

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($sellerListing, $admin, $data) {
            $listing = SellerListing::query()->lockForUpdate()->findOrFail($sellerListing->id);

            if ($listing->order_id || $listing->sold_at) {
                throw ValidationException::withMessages([
                    'status' => ['Cannot suspend a sold listing.'],
                ]);
            }

            $listing->status = 'suspended';
            $listing->status_reason = $data['reason'];
            $listing->reviewed_at = now();
            $listing->reviewed_by = $admin->id;
            $listing->approved_at = null;
            $listing->rejected_at = null;
            $listing->suspended_at = now();
            $listing->reserved_order_id = null;
            $listing->reserved_until = null;
            $listing->save();
        });

        try {
            /** @var AdminAuditLogger $audit */
            $audit = app(AdminAuditLogger::class);
            $audit->log($admin, 'marketplace.listing.suspend', [
                'seller_listing_id' => $sellerListing->id,
                'reason' => $data['reason'],
            ], 'marketplace', $request);
        } catch (\Throwable $e) {
        }

        return response()->json(['ok' => true]);
    }
}
