<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Seller;
use App\Models\SellerKycFile;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class SellerKycController extends Controller
{
    public function me(Request $request)
    {
        $user = $request->user();

        $seller = Seller::query()
            ->with('kycFiles')
            ->where('user_id', $user->id)
            ->first();

        if (!$seller) {
            return response()->json([
                'seller' => null,
            ]);
        }

        $filesByType = $seller->kycFiles->keyBy('type');

        return response()->json([
            'seller' => [
                'id' => $seller->id,
                'status' => $seller->status,
                'statusReason' => $seller->status_reason,
                'whatsappNumber' => $seller->whatsapp_number,
                'kycFullName' => $seller->kyc_full_name,
                'kycDob' => $seller->kyc_dob?->toDateString(),
                'kycCountry' => $seller->kyc_country,
                'kycCity' => $seller->kyc_city,
                'kycAddress' => $seller->kyc_address,
                'kycIdType' => $seller->kyc_id_type,
                'kycIdNumber' => $seller->kyc_id_number,
                'kycSubmittedAt' => $seller->kyc_submitted_at?->toIso8601String(),
                'approvedAt' => $seller->approved_at?->toIso8601String(),
                'rejectedAt' => $seller->rejected_at?->toIso8601String(),
                'suspendedAt' => $seller->suspended_at?->toIso8601String(),
                'bannedAt' => $seller->banned_at?->toIso8601String(),
                'partnerWalletFrozen' => (bool) $seller->partner_wallet_frozen,
                'partnerWalletFrozenAt' => $seller->partner_wallet_frozen_at?->toIso8601String(),
                'kycFiles' => [
                    'idFront' => $filesByType->has('id_front'),
                    'selfie' => $filesByType->has('selfie'),
                ],
            ],
        ]);
    }

    public function apply(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'fullName' => ['required', 'string', 'max:120'],
            'whatsappNumber' => ['required', 'string', 'max:32'],
            'dob' => ['nullable', 'date'],
            'country' => ['required', 'string', 'max:64'],
            'city' => ['required', 'string', 'max:80'],
            'address' => ['required', 'string', 'max:2000'],
            'idType' => ['required', 'string', 'max:32'],
            'idNumber' => ['required', 'string', 'max:64'],
        ]);

        $seller = Seller::query()->where('user_id', $user->id)->first();

        if ($seller && in_array($seller->status, ['suspended', 'banned'], true)) {
            throw ValidationException::withMessages([
                'seller' => ['Your seller account is not eligible to submit KYC at this time.'],
            ]);
        }

        if (!$seller) {
            $seller = new Seller();
            $seller->user_id = $user->id;
            $seller->status = 'pending_verification';
        }

        $seller->whatsapp_number = $data['whatsappNumber'];
        $seller->kyc_full_name = $data['fullName'];
        $seller->kyc_dob = $data['dob'] ?? null;
        $seller->kyc_country = $data['country'] ?? null;
        $seller->kyc_city = $data['city'] ?? null;
        $seller->kyc_address = $data['address'] ?? null;
        $seller->kyc_id_type = $data['idType'] ?? null;
        $seller->kyc_id_number = $data['idNumber'] ?? null;

        if ($seller->status !== 'approved') {
            $seller->status = 'pending_verification';
            $seller->kyc_submitted_at = now();
            $seller->rejected_at = null;
            $seller->status_reason = null;
        }

        $seller->save();

        return $this->me($request);
    }

    public function uploadIdFront(Request $request)
    {
        $user = $request->user();
        $seller = Seller::query()->where('user_id', $user->id)->firstOrFail();

        if (in_array($seller->status, ['suspended', 'banned'], true)) {
            return response()->json(['message' => 'Seller account is not allowed to upload KYC files.'], 403);
        }

        $data = $request->validate([
            'file' => ['required', 'file', 'image', 'max:5120'],
        ]);

        $file = $data['file'];
        $dir = "kyc/seller_{$seller->id}";
        $name = 'id_front_' . now()->format('Ymd_His') . '.' . $file->getClientOriginalExtension();

        $path = $file->storeAs($dir, $name, ['disk' => 'local']);
        $sha256 = @hash_file('sha256', $file->getRealPath()) ?: null;

        SellerKycFile::query()->updateOrCreate(
            ['seller_id' => $seller->id, 'type' => 'id_front'],
            [
                'source' => 'upload',
                'disk' => 'local',
                'path' => $path,
                'mime' => $file->getMimeType(),
                'size' => $file->getSize(),
                'sha256' => $sha256,
            ]
        );

        return response()->json(['ok' => true]);
    }

    public function captureSelfie(Request $request)
    {
        $user = $request->user();
        $seller = Seller::query()->where('user_id', $user->id)->firstOrFail();

        if (in_array($seller->status, ['suspended', 'banned'], true)) {
            return response()->json(['message' => 'Seller account is not allowed to upload KYC files.'], 403);
        }

        $data = $request->validate([
            'image' => ['required', 'file', 'image', 'max:5120'],
        ]);

        $file = $data['image'];
        $dir = "kyc/seller_{$seller->id}";
        $name = 'selfie_' . now()->format('Ymd_His') . '.' . $file->getClientOriginalExtension();

        $path = $file->storeAs($dir, $name, ['disk' => 'local']);
        $sha256 = @hash_file('sha256', $file->getRealPath()) ?: null;

        SellerKycFile::query()->updateOrCreate(
            ['seller_id' => $seller->id, 'type' => 'selfie'],
            [
                'source' => 'camera',
                'disk' => 'local',
                'path' => $path,
                'mime' => $file->getMimeType(),
                'size' => $file->getSize(),
                'sha256' => $sha256,
            ]
        );

        return response()->json(['ok' => true]);
    }
}
