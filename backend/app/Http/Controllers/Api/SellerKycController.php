<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Seller;
use App\Models\SellerKycFile;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use App\Services\SellerSalesLimitService;

class SellerKycController extends Controller
{
    public function __construct(private readonly SellerSalesLimitService $salesLimitService)
    {
    }

    private function ensureAgreementPdfExists(Seller $seller): ?string
    {
        if ($seller->status !== 'approved') {
            return null;
        }

        $diskName = (string) (config('filesystems.public_uploads_disk') ?: 'public');
        $disk = Storage::disk($diskName);
        $existing = $seller->agreement_pdf_path ? (string) $seller->agreement_pdf_path : '';
        if ($existing !== '' && $disk->exists($existing)) {
            return $existing;
        }

        $seller->loadMissing('user');
        $issuedAt = now();
        $certificateCode = sprintf(
            'PG-SLR-%06d-%s',
            (int) $seller->id,
            strtoupper(Str::random(6))
        );
        $watermarkText = sprintf(
            'PRIME GAMING • %s • %s • %s',
            (string) ($seller->company_name ?: $seller->kyc_full_name ?: 'SELLER'),
            $certificateCode,
            $issuedAt->format('Y-m-d H:i')
        );

        $html = view('seller-agreement', [
            'seller' => $seller,
            'issuedAt' => $issuedAt,
            'certificateCode' => $certificateCode,
            'watermarkText' => $watermarkText,
        ])->render();

        $options = new Options();
        $options->set('isRemoteEnabled', false);
        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4');
        $dompdf->render();

        $pdfPath = 'seller-agreements/seller-' . $seller->id . '-agreement.pdf';
        $disk->put($pdfPath, $dompdf->output());

        $seller->agreement_pdf_path = $pdfPath;
        $seller->agreement_pdf_generated_at = now();
        $seller->save();

        return $pdfPath;
    }

    public function downloadAgreementPdf(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $seller = Seller::query()
            ->where('user_id', $user->id)
            ->first();

        if (!$seller) {
            return response()->json(['message' => 'Seller not found.'], 404);
        }

        if ($seller->status !== 'approved') {
            return response()->json(['message' => 'Seller agreement is only available for approved sellers.'], 403);
        }

        try {
            $path = $this->ensureAgreementPdfExists($seller);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Unable to generate agreement PDF.'], 500);
        }

        if (!$path) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        $diskName = (string) (config('filesystems.public_uploads_disk') ?: 'public');
        $disk = Storage::disk($diskName);
        if (!$disk->exists($path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        $downloadName = 'document-vendeur-primegaming-' . $seller->id . '.pdf';
        return $disk->download($path, $downloadName);
    }

    public function me(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

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

        $agreementUrl = $seller->status === 'approved' ? url('/api/seller/agreement-pdf') : null;
        $monthlySales = $this->salesLimitService->monthlySalesForSeller($seller);
        $requiresVipUpgrade = $this->salesLimitService->requiresVipUpgrade($seller);

        return response()->json([
            'seller' => [
                'id' => $seller->id,
                'status' => $seller->status,
                'statusReason' => $seller->status_reason,
                'whatsappNumber' => $seller->whatsapp_number,
            'companyName' => $seller->company_name,
                'kycFullName' => $seller->kyc_full_name,
                'kycDob' => $seller->kyc_dob?->toDateString(),
                'kycCountry' => $seller->kyc_country,
                'kycCity' => $seller->kyc_city,
                'kycAddress' => $seller->kyc_address,
                'kycIdType' => $seller->kyc_id_type,
                'kycIdNumber' => $seller->kyc_id_number,
                'kycSubmittedAt' => $seller->kyc_submitted_at?->toIso8601String(),
                'termsAcceptedAt' => $seller->terms_accepted_at?->toIso8601String(),
                'approvedAt' => $seller->approved_at?->toIso8601String(),
                'rejectedAt' => $seller->rejected_at?->toIso8601String(),
                'suspendedAt' => $seller->suspended_at?->toIso8601String(),
                'bannedAt' => $seller->banned_at?->toIso8601String(),
                'partnerWalletFrozen' => (bool) $seller->partner_wallet_frozen,
                'partnerWalletFrozenAt' => $seller->partner_wallet_frozen_at?->toIso8601String(),
                'agreementPdfUrl' => $agreementUrl,
                'agreementPdfGeneratedAt' => $seller->agreement_pdf_generated_at?->toIso8601String(),
                'monthlySales' => $monthlySales,
                'nonVipMonthlyLimit' => SellerSalesLimitService::NON_VIP_MONTHLY_LIMIT,
                'requiresVipUpgradeForSales' => $requiresVipUpgrade,
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

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $seller = Seller::query()->where('user_id', $user->id)->first();

        $acceptTermsInput = $request->input('acceptTerms', $request->input('accept_terms'));
        if ($acceptTermsInput === null && $seller?->terms_accepted_at) {
            $acceptTermsInput = true;
        }

        $request->merge([
            'fullName' => $request->input('fullName', $request->input('full_name')),
            'companyName' => $request->input('companyName', $request->input('company_name')),
            'whatsappNumber' => $request->input('whatsappNumber', $request->input('whatsapp_number')),
            'dob' => $request->input('dob', $request->input('date_of_birth')),
            'country' => $request->input('country', $request->input('kyc_country')),
            'city' => $request->input('city', $request->input('kyc_city')),
            'address' => $request->input('address', $request->input('kyc_address')),
            'idType' => $request->input('idType', $request->input('id_type')),
            'idNumber' => $request->input('idNumber', $request->input('id_number')),
            'acceptTerms' => $acceptTermsInput,
        ]);

        $data = $request->validate([
            'fullName' => ['required', 'string', 'max:120'],
            'companyName' => ['required', 'string', 'max:120'],
            'whatsappNumber' => ['required', 'string', 'max:32'],
            'dob' => ['nullable', 'date'],
            'country' => ['required', 'string', 'max:64'],
            'city' => ['required', 'string', 'max:80'],
            'address' => ['required', 'string', 'max:2000'],
            'idType' => ['required', 'string', 'max:32'],
            'idNumber' => ['required', 'string', 'max:64'],
            'acceptTerms' => ['required', 'accepted'],
        ]);

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
        $seller->company_name = $data['companyName'];
        $seller->kyc_full_name = $data['fullName'];
        $seller->kyc_dob = $data['dob'] ?? null;
        $seller->kyc_country = $data['country'] ?? null;
        $seller->kyc_city = $data['city'] ?? null;
        $seller->kyc_address = $data['address'] ?? null;
        $seller->kyc_id_type = $data['idType'] ?? null;
        $seller->kyc_id_number = $data['idNumber'] ?? null;
        $seller->terms_accepted_at = now();

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

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }
        $seller = Seller::query()->where('user_id', $user->id)->firstOrFail();

        if (in_array($seller->status, ['suspended', 'banned'], true)) {
            return response()->json(['message' => 'Seller account is not allowed to upload KYC files.'], 403);
        }

        $data = $request->validate([
            'file' => ['required', 'file', 'max:5120', 'mimes:jpg,jpeg,png,webp,gif,bmp,avif,heic,heif'],
        ]);

        $file = $data['file'];
        $dir = "kyc/seller_{$seller->id}";
        $ext = strtolower((string) $file->getClientOriginalExtension());
        if ($ext === '') {
            $ext = 'jpg';
        }
        $name = 'id_front_' . now()->format('Ymd_His') . '_' . Str::random(32) . '.' . $ext;

        $previous = SellerKycFile::query()->where('seller_id', $seller->id)->where('type', 'id_front')->first();

        $path = $file->storeAs($dir, $name, 'public');
        $sha256 = @hash_file('sha256', $file->getRealPath()) ?: null;

        SellerKycFile::query()->updateOrCreate(
            ['seller_id' => $seller->id, 'type' => 'id_front'],
            [
                'source' => 'upload',
                'disk' => 'public',
                'path' => $path,
                'mime' => $file->getMimeType(),
                'size' => $file->getSize(),
                'sha256' => $sha256,
            ]
        );

        if ($previous && $previous->path && $previous->path !== $path) {
            try {
                Storage::disk($previous->disk ?: 'public')->delete($previous->path);
            } catch (\Throwable $e) {
                // best-effort
            }
        }

        return response()->json(['ok' => true]);
    }

    public function captureSelfie(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }
        $seller = Seller::query()->where('user_id', $user->id)->firstOrFail();

        if (in_array($seller->status, ['suspended', 'banned'], true)) {
            return response()->json(['message' => 'Seller account is not allowed to upload KYC files.'], 403);
        }

        $data = $request->validate([
            'image' => ['required', 'file', 'max:5120', 'mimes:jpg,jpeg,png,webp,gif,bmp,avif,heic,heif'],
        ]);

        $file = $data['image'];
        $dir = "kyc/seller_{$seller->id}";
        $ext = strtolower((string) $file->getClientOriginalExtension());
        if ($ext === '') {
            $ext = 'jpg';
        }
        $name = 'selfie_' . now()->format('Ymd_His') . '_' . Str::random(32) . '.' . $ext;

        $previous = SellerKycFile::query()->where('seller_id', $seller->id)->where('type', 'selfie')->first();

        $path = $file->storeAs($dir, $name, 'public');
        $sha256 = @hash_file('sha256', $file->getRealPath()) ?: null;

        SellerKycFile::query()->updateOrCreate(
            ['seller_id' => $seller->id, 'type' => 'selfie'],
            [
                'source' => 'camera',
                'disk' => 'public',
                'path' => $path,
                'mime' => $file->getMimeType(),
                'size' => $file->getSize(),
                'sha256' => $sha256,
            ]
        );

        if ($previous && $previous->path && $previous->path !== $path) {
            try {
                Storage::disk($previous->disk ?: 'public')->delete($previous->path);
            } catch (\Throwable $e) {
                // best-effort
            }
        }

        return response()->json(['ok' => true]);
    }
}
