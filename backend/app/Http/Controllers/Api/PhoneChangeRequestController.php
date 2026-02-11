<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PhoneChangeRequest;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PhoneChangeRequestController extends Controller
{
    public function store(Request $request)
    {
        $user = $request->user();

        // VIP users change phone via live chat flow.
        if ($user?->is_premium) {
            return response()->json(['message' => 'VIP users must use live chat to change phone.'], 403);
        }

        $data = $request->validate([
            'old_phone' => ['required', 'string', 'max:64'],
            'new_phone' => ['required', 'string', 'max:64'],
            'reason' => ['nullable', 'string', 'max:2000'],
            'attachment' => ['nullable', 'file', 'max:5120'],
        ]);

        $oldPhone = trim((string) $data['old_phone']);
        $newPhone = trim((string) $data['new_phone']);

        $requestRow = PhoneChangeRequest::create([
            'user_id' => $user->id,
            'old_phone' => $oldPhone,
            'new_phone' => $newPhone,
            'reason' => $data['reason'] ?? null,
            'status' => 'pending',
        ]);

        $disk = Storage::disk('public');

        if ($request->hasFile('attachment')) {
            $attachment = $request->file('attachment');
            $path = $attachment->storeAs(
                'phone-change-requests/attachments',
                'phone-change-' . $requestRow->id . '-' . time() . '.' . $attachment->getClientOriginalExtension(),
                'public'
            );
            $requestRow->attachment_path = $path;
        }

        // Generate a PDF summary for admin review.
        try {
            $html = view('phone-change-request', [
                'requestRow' => $requestRow,
                'user' => $user,
            ])->render();

            $options = new Options();
            $options->set('isRemoteEnabled', true);
            $dompdf = new Dompdf($options);
            $dompdf->loadHtml($html);
            $dompdf->setPaper('A4');
            $dompdf->render();

            $pdfPath = 'phone-change-requests/pdfs/phone-change-request-' . $requestRow->id . '.pdf';
            $disk->put($pdfPath, $dompdf->output());
            $requestRow->pdf_path = $pdfPath;
        } catch (\Throwable $e) {
            // PDF is optional; request remains valid.
        }

        $requestRow->save();

        return response()->json([
            'ok' => true,
            'data' => [
                'request' => $requestRow,
                'pdf_url' => $requestRow->pdf_path ? $disk->url($requestRow->pdf_path) : null,
                'attachment_url' => $requestRow->attachment_path ? $disk->url($requestRow->attachment_path) : null,
            ],
        ], 201);
    }
}
