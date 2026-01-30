<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RedeemLot;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AdminRedeemLotController extends Controller
{
    public function index(Request $request)
    {
        $query = RedeemLot::query()
            ->with(['denomination.product:id,name,sku', 'creator:id,email'])
            ->withCount([
                'codes as total_codes' => fn ($q) => $q,
                'codes as available_count' => fn ($q) => $q->where('status', 'available'),
                'codes as assigned_count' => fn ($q) => $q->whereIn('status', ['assigned', 'sent', 'used']),
                'codes as expired_count' => fn ($q) => $q->where('status', 'expired'),
            ])
            ->latest('id');

        if ($request->filled('denomination_id')) {
            $query->where('denomination_id', $request->query('denomination_id'));
        }

        if ($request->filled('code')) {
            $query->where('code', 'like', '%' . $request->query('code') . '%');
        }

        $perPage = $request->integer('per_page', 30);
        $perPage = max(1, min($perPage, 100));

        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'denomination_id' => 'required|exists:redeem_denominations,id',
            'code' => 'nullable|string|max:64',
            'label' => 'nullable|string|max:255',
            'supplier' => 'nullable|string|max:128',
            'purchase_price_fcfa' => 'nullable|integer|min:0',
            'received_at' => 'nullable|date',
        ]);

        $code = trim((string) ($data['code'] ?? ''));
        if ($code === '') {
            $code = 'LOT-' . strtoupper(Str::random(10));
        }

        $lot = RedeemLot::create([
            'denomination_id' => (int) $data['denomination_id'],
            'code' => $code,
            'label' => $data['label'] ?? null,
            'supplier' => $data['supplier'] ?? null,
            'purchase_price_fcfa' => $data['purchase_price_fcfa'] ?? null,
            'received_at' => $data['received_at'] ?? null,
            'created_by' => $request->user()?->id,
        ]);

        return response()->json(['data' => $lot->load(['denomination.product:id,name,sku', 'creator:id,email'])], 201);
    }
}
