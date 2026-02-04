<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PartnerWallet;
use App\Models\Seller;
use App\Models\SellerKycFile;
use App\Models\SellerListing;
use App\Models\SellerStat;
use App\Services\AdminAuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class AdminMarketplaceSellerController extends Controller
{
    public function index(Request $request)
    {
        $q = Seller::query()->with('user');

        if ($request->filled('status')) {
            $q->where('status', $request->string('status')->toString());
        }

        if ($request->filled('search')) {
            $search = '%' . $request->string('search')->toString() . '%';
            $q->where(function ($sub) use ($search) {
                $sub->where('kyc_full_name', 'like', $search)
                    ->orWhere('whatsapp_number', 'like', $search)
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('email', 'like', $search)->orWhere('name', 'like', $search);
                    });
            });
        }

        $sellers = $q->orderByDesc('updated_at')->paginate(30);

        return response()->json(['data' => $sellers]);
    }

    public function show(Seller $seller)
    {
        $seller->load(['user', 'kycFiles', 'stats', 'partnerWallet']);

        return response()->json([
            'data' => [
                'seller' => $seller,
                'kycFiles' => $seller->kycFiles,
                'stats' => $seller->stats,
                'partnerWallet' => $seller->partnerWallet,
            ],
        ]);
    }

    public function downloadKycFile(Request $request, Seller $seller, string $type)
    {
        if (!in_array($type, ['id_front', 'selfie'], true)) {
            return response()->json(['message' => 'Invalid file type.'], 422);
        }

        $file = SellerKycFile::query()
            ->where('seller_id', $seller->id)
            ->where('type', $type)
            ->first();

        if (!$file) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        $disk = $file->disk ?: 'local';

        if (!Storage::disk($disk)->exists($file->path)) {
            return response()->json(['message' => 'File missing on storage.'], 404);
        }

        $downloadName = "seller_{$seller->id}_{$type}." . (pathinfo($file->path, PATHINFO_EXTENSION) ?: 'jpg');

        return Storage::disk($disk)->download($file->path, $downloadName);
    }

    public function approve(Request $request, Seller $seller)
    {
        $admin = $request->user();

        DB::transaction(function () use ($seller) {
            $seller->status = 'approved';
            $seller->approved_at = now();
            $seller->rejected_at = null;
            $seller->suspended_at = null;
            $seller->banned_at = null;
            $seller->status_reason = null;
            $seller->partner_wallet_frozen = false;
            $seller->partner_wallet_frozen_at = null;
            $seller->save();

            PartnerWallet::query()->firstOrCreate(
                ['seller_id' => $seller->id],
                [
                    'currency' => 'FCFA',
                    'available_balance' => 0,
                    'pending_balance' => 0,
                    'status' => 'active',
                ]
            );

            SellerStat::query()->firstOrCreate(['seller_id' => $seller->id]);
        });

        try {
            /** @var AdminAuditLogger $audit */
            $audit = app(AdminAuditLogger::class);
            $audit->log($admin, 'marketplace.seller.approve', [
                'seller_id' => $seller->id,
                'user_id' => $seller->user_id,
            ], 'marketplace', $request);
        } catch (\Throwable $e) {
        }

        return response()->json(['ok' => true]);
    }

    public function refuse(Request $request, Seller $seller)
    {
        $admin = $request->user();

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        if ($seller->status === 'approved') {
            return response()->json(['message' => 'Cannot refuse an approved seller. Use suspend/ban.'], 422);
        }

        $seller->status = 'pending_verification';
        $seller->rejected_at = now();
        $seller->status_reason = $data['reason'];
        $seller->save();

        try {
            /** @var AdminAuditLogger $audit */
            $audit = app(AdminAuditLogger::class);
            $audit->log($admin, 'marketplace.seller.refuse', [
                'seller_id' => $seller->id,
                'reason' => $data['reason'],
            ], 'marketplace', $request);
        } catch (\Throwable $e) {
        }

        return response()->json(['ok' => true]);
    }

    public function suspend(Request $request, Seller $seller)
    {
        $admin = $request->user();

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($seller, $data) {
            $seller->status = 'suspended';
            $seller->suspended_at = now();
            $seller->status_reason = $data['reason'];
            $seller->partner_wallet_frozen = true;
            $seller->partner_wallet_frozen_at = now();
            $seller->save();

            PartnerWallet::query()->where('seller_id', $seller->id)->update([
                'status' => 'frozen',
                'status_reason' => $data['reason'],
                'frozen_at' => now(),
            ]);

            SellerListing::query()->where('seller_id', $seller->id)->where('status', '!=', 'sold')->update([
                'status' => 'disabled',
                'status_reason' => $data['reason'],
            ]);
        });

        try {
            /** @var AdminAuditLogger $audit */
            $audit = app(AdminAuditLogger::class);
            $audit->log($admin, 'marketplace.seller.suspend', [
                'seller_id' => $seller->id,
                'reason' => $data['reason'],
            ], 'marketplace', $request);
        } catch (\Throwable $e) {
        }

        return response()->json(['ok' => true]);
    }

    public function ban(Request $request, Seller $seller)
    {
        $admin = $request->user();

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($seller, $data) {
            $seller->status = 'banned';
            $seller->banned_at = now();
            $seller->status_reason = $data['reason'];
            $seller->partner_wallet_frozen = true;
            $seller->partner_wallet_frozen_at = now();
            $seller->save();

            PartnerWallet::query()->where('seller_id', $seller->id)->update([
                'status' => 'frozen',
                'status_reason' => $data['reason'],
                'frozen_at' => now(),
            ]);

            SellerListing::query()->where('seller_id', $seller->id)->where('status', '!=', 'sold')->update([
                'status' => 'disabled',
                'status_reason' => $data['reason'],
            ]);
        });

        try {
            /** @var AdminAuditLogger $audit */
            $audit = app(AdminAuditLogger::class);
            $audit->log($admin, 'marketplace.seller.ban', [
                'seller_id' => $seller->id,
                'reason' => $data['reason'],
            ], 'marketplace', $request);
        } catch (\Throwable $e) {
        }

        return response()->json(['ok' => true]);
    }
}
