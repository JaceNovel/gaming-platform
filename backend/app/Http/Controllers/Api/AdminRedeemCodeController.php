<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RedeemCode;
use App\Models\RedeemDenomination;
use App\Models\RedeemLot;
use App\Models\Product;
use App\Services\AdminAuditLogger;
use App\Services\RedeemStockAlertService;
use App\Services\StockService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminRedeemCodeController extends Controller
{
    public function index(Request $request)
    {
        $query = RedeemCode::with(['denomination', 'assignedOrder', 'assignedUser'])
            ->latest('id');

        if ($request->filled('product_id')) {
            $productId = $request->query('product_id');
            $query->whereHas('denomination', fn ($q) => $q->where('product_id', $productId));
        }

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

    public function store(Request $request, AdminAuditLogger $auditLogger, StockService $stockService)
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

        $stockService->logRedeemImport($code->denomination, 1, $request->user(), [
            'source' => 'redeem_manual',
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

    public function export(Request $request)
    {
        $query = RedeemCode::with(['denomination', 'assignedOrder', 'assignedUser'])
            ->latest('id');

        if ($request->filled('category')) {
            $category = $request->query('category');
            $query->whereHas('denomination', fn ($q) => $q->where('code', $category));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $filename = 'redeem-codes-' . now()->format('Ymd_His') . '.csv';

        return new StreamedResponse(function () use ($query) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'id',
                'denomination',
                'code',
                'status',
                'order_id',
                'user_email',
                'assigned_at',
                'sent_at',
                'imported_at',
            ]);

            $query->chunk(500, function ($rows) use ($handle) {
                foreach ($rows as $row) {
                    fputcsv($handle, [
                        $row->id,
                        $row->denomination?->code,
                        $row->code,
                        $row->status,
                        $row->assigned_order_id,
                        $row->assignedUser?->email,
                        optional($row->assigned_at)->toIso8601String(),
                        optional($row->sent_at)->toIso8601String(),
                        optional($row->imported_at)->toIso8601String(),
                    ]);
                }
            });

            fclose($handle);
        }, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
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

    public function import(Request $request, AdminAuditLogger $auditLogger, StockService $stockService, RedeemStockAlertService $alertService)
    {
        $data = $request->validate([
            'denomination_id' => 'nullable|exists:redeem_denominations,id|required_without:product_id',
            'product_id' => 'nullable|exists:products,id|required_without:denomination_id',
            'lot_id' => 'nullable|exists:redeem_lots,id',
            'lot_code' => 'nullable|string|max:64',
            'lot_label' => 'nullable|string|max:255',
            'lot_supplier' => 'nullable|string|max:128',
            'lot_purchase_price_fcfa' => 'nullable|integer|min:0',
            'codes' => 'nullable|string',
            'file' => 'nullable|file|mimes:txt,csv',
            'dry_run' => 'sometimes|boolean',
        ]);

        if (!$request->filled('codes') && !$request->file('file')) {
            return response()->json(['message' => 'Provide codes or upload a file'], 422);
        }

        $denomination = null;
        if (!empty($data['denomination_id'])) {
            $denomination = RedeemDenomination::findOrFail($data['denomination_id']);
        } else {
            $productId = (int) ($data['product_id'] ?? 0);
            if ($productId <= 0) {
                return response()->json(['message' => 'Select a product'], 422);
            }

            $denomination = RedeemDenomination::query()
                ->where('product_id', $productId)
                ->orderByDesc('active')
                ->orderBy('diamonds')
                ->orderBy('id')
                ->first();

            if (!$denomination) {
                $product = Product::findOrFail($productId);

                $base = trim((string) ($product->redeem_sku ?? ''));
                if ($base === '') {
                    $base = trim((string) ($product->sku ?? ''));
                }
                if ($base === '') {
                    $base = 'P' . $product->id;
                }

                $base = strtoupper(preg_replace('/[^A-Z0-9]+/', '', $base) ?: ('P' . $product->id));
                $base = substr($base, 0, 24);

                $code = null;
                for ($i = 0; $i < 10; $i++) {
                    $suffix = $i === 0 ? ('-' . $product->id) : ('-' . $product->id . '-' . strtoupper(Str::random(4)));
                    $candidate = substr($base, 0, max(1, 32 - strlen($suffix))) . $suffix;
                    if (!RedeemDenomination::where('code', $candidate)->exists()) {
                        $code = $candidate;
                        break;
                    }
                }

                if (!$code) {
                    return response()->json(['message' => 'Impossible de générer une dénomination unique pour ce produit.'], 500);
                }

                $label = trim((string) ($product->name ?? ''));
                $label = $label !== '' ? ($label . ' (Auto)') : ('Produit ' . $product->id . ' (Auto)');

                $denomination = RedeemDenomination::create([
                    'product_id' => $product->id,
                    'code' => $code,
                    'label' => $label,
                    'diamonds' => 0,
                    'active' => true,
                ]);
            }
        }

        $lotId = null;
        if (!empty($data['lot_id'])) {
            $lotId = (int) $data['lot_id'];
        } elseif (!empty($data['lot_code'])) {
            $lotCode = trim((string) $data['lot_code']);
            if ($lotCode !== '') {
                $lot = RedeemLot::firstOrCreate(
                    ['code' => $lotCode],
                    [
                        'denomination_id' => $denomination->id,
                        'label' => $data['lot_label'] ?? null,
                        'supplier' => $data['lot_supplier'] ?? null,
                        'purchase_price_fcfa' => $data['lot_purchase_price_fcfa'] ?? null,
                        'received_at' => now(),
                        'created_by' => $request->user()->id,
                    ]
                );
                $lotId = $lot->id;
            }
        }
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
            'lot_id' => $lotId,
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

        $stockService->logRedeemImport($denomination, count($insertPayload), $request->user(), [
            'source' => 'redeem_import',
        ]);

        $alertService->notifyIfLowStock($denomination);

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
            ->when(request()->filled('product_id'), fn ($query) => $query->where('product_id', request()->query('product_id')))
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

    public function lowStockProducts()
    {
        $denominations = RedeemDenomination::with(['product'])
            ->withCount([
                'codes as available_count' => fn ($query) => $query->where('status', 'available'),
            ])
            ->get()
            ->filter(fn ($denom) => $denom->available_count < ($denom->low_stock_threshold ?? $denom->product?->stock_low_threshold ?? 0))
            ->values();

        return response()->json([
            'data' => $denominations->map(fn ($denom) => [
                'denomination_id' => $denom->id,
                'product_id' => $denom->product_id,
                'product_name' => $denom->product?->name,
                'label' => $denom->label,
                'available' => (int) $denom->available_count,
                'threshold' => $denom->low_stock_threshold ?? $denom->product?->stock_low_threshold,
            ]),
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
