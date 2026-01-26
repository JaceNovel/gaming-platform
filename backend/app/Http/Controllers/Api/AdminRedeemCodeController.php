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
    public function index(Request $request)
    {
        $query = RedeemCode::with(['denomination', 'assignedOrder', 'assignedUser'])
            ->latest('id');

        if ($request->filled('category')) {
            $category = $request->query('category');
            $query->whereHas('denomination', fn ($q) => $q->where('code', $category));
        }

        if ($request->filled('denomination_id')) {
            $query->where('denomination_id', $request->query('denomination_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('code')) {
            $query->where('code', 'like', '%' . $request->query('code') . '%');
        }

        $perPage = $request->integer('per_page', 30);

        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request, AdminAuditLogger $auditLogger)
    {
        $data = $request->validate([
            'denomination_id' => 'required|exists:redeem_denominations,id',
            'code' => 'required|string|max:191',
        ]);

        $code = RedeemCode::create([
            'denomination_id' => $data['denomination_id'],
            'code' => trim($data['code']),
            'status' => 'available',
            'imported_by' => $request->user()->id,
            'imported_at' => now(),
        ]);

        $auditLogger->log(
            $request->user(),
            'redeem_add',
            [
                'message' => 'Manual add redeem code',
                'redeem_id' => $code->id,
            ],
            actionType: 'redeem_stock',
            request: $request
        );

        return response()->json([
            'data' => $code,
        ], 201);
    }

    public function invalidate(Request $request, RedeemCode $redeemCode, AdminAuditLogger $auditLogger)
    {
        if (in_array($redeemCode->status, ['used', 'sent', 'assigned'], true)) {
            return response()->json(['message' => 'Cannot invalidate assigned/used code'], 422);
        }

        $redeemCode->update([
            'status' => 'expired',
            'meta' => array_merge((array) $redeemCode->meta, [
                'invalidated_by' => $request->user()->id,
                'invalidated_at' => now()->toIso8601String(),
            ]),
        ]);

        $auditLogger->log(
            $request->user(),
            'redeem_invalidate',
            [
                'message' => 'Invalidated redeem code',
                'redeem_id' => $redeemCode->id,
            ],
            actionType: 'redeem_stock',
            request: $request
        );

        return response()->json(['message' => 'Redeem code invalidated']);
    }

    public function used(Request $request)
    {
        $query = RedeemCode::with(['denomination', 'assignedOrder', 'assignedUser'])
            ->whereIn('status', ['assigned', 'sent', 'used']);

        if ($request->filled('from')) {
            $query->whereDate('assigned_at', '>=', $request->query('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('assigned_at', '<=', $request->query('to'));
        }

        $perPage = $request->integer('per_page', 30);

        return response()->json($query->latest('assigned_at')->paginate($perPage));
    }
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

    public function stats()
    {
        $denominations = RedeemDenomination::withCount([
            'codes as available_count' => fn ($query) => $query->where('status', 'available'),
            'codes as reserved_count' => fn ($query) => $query->where('status', 'reserved'),
            'codes as assigned_count' => fn ($query) => $query->whereIn('status', ['assigned', 'sent', 'used']),
        ])
            ->orderBy('diamonds')
            ->get()
            ->map(fn ($denom) => [
                'id' => $denom->id,
                'code' => $denom->code,
                'label' => $denom->label,
                'diamonds' => $denom->diamonds,
                'available' => (int) $denom->available_count,
                'reserved' => (int) $denom->reserved_count,
                'assigned' => (int) $denom->assigned_count,
                'low_stock' => $denom->is_low_stock,
            ]);

        return response()->json([
            'data' => $denominations,
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
