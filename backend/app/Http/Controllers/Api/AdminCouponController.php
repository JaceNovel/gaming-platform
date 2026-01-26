<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Services\AdminAuditLogger;
use Illuminate\Http\Request;

class AdminCouponController extends Controller
{
    public function index(Request $request)
    {
        $query = Coupon::query()->latest('id');

        if ($request->filled('code')) {
            $query->where('code', 'like', '%' . $request->query('code') . '%');
        }

        if ($request->filled('active')) {
            $query->where('is_active', $request->boolean('active'));
        }

        $perPage = $request->integer('per_page', 30);

        return response()->json($query->paginate($perPage));
    }

    public function show(Coupon $coupon)
    {
        return response()->json(['data' => $coupon]);
    }

    public function store(Request $request, AdminAuditLogger $auditLogger)
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'code' => 'required|string|max:64|unique:coupons,code',
            'description' => 'nullable|string',
            'type' => 'required|string|in:percent,fixed',
            'discount_percent' => 'nullable|numeric|min:0|max:100',
            'discount_value' => 'nullable|numeric|min:0',
            'max_uses' => 'nullable|integer|min:1',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date',
            'expires_at' => 'nullable|date',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($data['type'] === 'percent' && empty($data['discount_percent'])) {
            return response()->json(['message' => 'Discount percent is required'], 422);
        }

        if ($data['type'] === 'fixed' && empty($data['discount_value'])) {
            return response()->json(['message' => 'Discount value is required'], 422);
        }

        $coupon = Coupon::create($data);

        $auditLogger->log(
            $request->user(),
            'coupon_create',
            [
                'message' => 'Created coupon',
                'coupon_id' => $coupon->id,
            ],
            actionType: 'promotions',
            request: $request
        );

        return response()->json(['data' => $coupon], 201);
    }

    public function update(Request $request, Coupon $coupon, AdminAuditLogger $auditLogger)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:120',
            'code' => 'sometimes|string|max:64|unique:coupons,code,' . $coupon->id,
            'description' => 'nullable|string',
            'type' => 'sometimes|string|in:percent,fixed',
            'discount_percent' => 'nullable|numeric|min:0|max:100',
            'discount_value' => 'nullable|numeric|min:0',
            'max_uses' => 'nullable|integer|min:1',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date',
            'expires_at' => 'nullable|date',
            'is_active' => 'sometimes|boolean',
        ]);

        $type = $data['type'] ?? $coupon->type ?? 'percent';
        $discountPercent = $data['discount_percent'] ?? $coupon->discount_percent;
        $discountValue = $data['discount_value'] ?? $coupon->discount_value;

        if ($type === 'percent' && empty($discountPercent)) {
            return response()->json(['message' => 'Discount percent is required'], 422);
        }

        if ($type === 'fixed' && empty($discountValue)) {
            return response()->json(['message' => 'Discount value is required'], 422);
        }

        $coupon->update($data);

        $auditLogger->log(
            $request->user(),
            'coupon_update',
            [
                'message' => 'Updated coupon',
                'coupon_id' => $coupon->id,
            ],
            actionType: 'promotions',
            request: $request
        );

        return response()->json(['data' => $coupon]);
    }

    public function destroy(Request $request, Coupon $coupon, AdminAuditLogger $auditLogger)
    {
        $coupon->delete();

        $auditLogger->log(
            $request->user(),
            'coupon_delete',
            [
                'message' => 'Deleted coupon',
                'coupon_id' => $coupon->id,
            ],
            actionType: 'promotions',
            request: $request
        );

        return response()->json(['message' => 'Coupon deleted']);
    }
}
