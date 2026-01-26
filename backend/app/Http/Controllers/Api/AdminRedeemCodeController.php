<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RedeemCode;
use App\Models\RedeemDenomination;
use App\Services\AdminAuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminRedeemCodeController extends Controller
{
    public function denominations(Request $request)
    {
        $denominations = RedeemDenomination::with('product:id,name,sku')
            ->withCount([
                'codes as available_count' => fn ($query) => $query->where('status', 'available'),
                'codes as reserved_count' => fn ($query) => $query->where('status', 'reserved'),
                'codes as assigned_count' => fn ($query) => $query->whereIn('status', ['assigned', 'sent', 'used']),
            ])
            ->orderByDesc('active')
            ->orderBy('diamonds')
            ->get();

        return response()->json([
            'data' => $denominations,
        ]);
    }

    public function import(Request $request, AdminAuditLogger $auditLogger)
    {
        $data = $request->validate([
            'denomination_id' => 'required|exists:redeem_denominations,id',
            'codes' => 'nullable|string',
            'file' => 'nullable|file|mimes:txt,csv',
            'dry_run' => 'sometimes|boolean',
        ]);

        if (!$request->filled('codes') && !$request->file('file')) {
            return response()->json(['message' => 'Provide codes or upload a file'], 422);
        }

        $denomination = RedeemDenomination::findOrFail($data['denomination_id']);
        $rawCodes = $this->collectCodes($data['codes'] ?? '', $request->file('file'));

        if ($rawCodes->isEmpty()) {
            return response()->json(['message' => 'No codes found'], 422);
        }

        $existing = RedeemCode::where('denomination_id', $denomination->id)
            ->whereIn('code', $rawCodes->all())
            ->pluck('code')
            ->all();

        $existingSet = collect($existing);
        $toInsert = $rawCodes->diff($existingSet)->values();

        if ($request->boolean('dry_run')) {
            return response()->json([
                'summary' => [
                    'received' => $rawCodes->count(),
                    'duplicates' => $existingSet->count(),
                    'importable' => $toInsert->count(),
                ],
            ]);
        }

        $now = now();
        $insertPayload = $toInsert->map(fn ($code) => [
            'denomination_id' => $denomination->id,
            'code' => $code,
            'status' => 'available',
            'imported_by' => $request->user()->id,
            'imported_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all();

        DB::transaction(function () use ($insertPayload) {
            foreach (array_chunk($insertPayload, 500) as $chunk) {
                RedeemCode::insert($chunk);
            }
        });

        $auditLogger->log(
            $request->user(),
            'redeem_import',
            [
                'message' => 'Import codes',
                'denomination_id' => $denomination->id,
                'imported' => count($insertPayload),
                'duplicates' => $existingSet->count(),
            ],
            actionType: 'redeem_stock',
            request: $request
        );

        return response()->json([
            'message' => 'Codes imported',
            'imported' => count($insertPayload),
            'duplicates' => $existingSet->count(),
        ]);
    }

    private function collectCodes(?string $manualInput, $file)
    {
        $lines = collect();

        if ($manualInput) {
            $lines = $lines->merge(preg_split('/\r?\n|,/', $manualInput));
        }

        if ($file) {
            $content = $file->get();
            $lines = $lines->merge(preg_split('/\r?\n|,/', $content));
        }

        return $lines
            ->map(fn ($line) => trim((string) $line))
            ->filter(fn ($line) => $line !== '')
            ->unique();
    }
}
