<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MarketplaceCommissionRule;
use Illuminate\Http\Request;

class AdminMarketplaceCommissionController extends Controller
{
    public function index()
    {
        $rules = MarketplaceCommissionRule::query()
            ->with('category')
            ->orderByRaw('CASE WHEN category_id IS NULL THEN 0 ELSE 1 END')
            ->orderBy('category_id')
            ->get();

        return response()->json(['data' => $rules]);
    }

    public function upsert(Request $request)
    {
        $data = $request->validate([
            'categoryId' => ['nullable', 'integer', 'exists:categories,id'],
            'mode' => ['required', 'in:fixed,percent'],
            'fixedAmount' => ['nullable', 'numeric', 'min:0'],
            'percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'isActive' => ['nullable', 'boolean'],
        ]);

        $payload = [
            'mode' => $data['mode'],
            'fixed_amount' => $data['mode'] === 'fixed' ? ($data['fixedAmount'] ?? 0) : null,
            'percent' => $data['mode'] === 'percent' ? ($data['percent'] ?? 0) : null,
            'is_active' => array_key_exists('isActive', $data) ? (bool) $data['isActive'] : true,
        ];

        $rule = MarketplaceCommissionRule::query()->updateOrCreate(
            ['category_id' => $data['categoryId'] ?? null],
            $payload
        );

        return response()->json(['data' => $rule]);
    }
}
