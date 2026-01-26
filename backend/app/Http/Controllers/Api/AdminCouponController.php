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

    public function store(Request $request, AdminAuditLogger $auditLogger)
    {
        $data = $request->validate([
            'code' => 'required|string|max:64|unique:coupons,code',
            'discount_percent' => 'required|numeric|min:0|max:100',
            'expires_at' => 'nullable|date',
            'is_active' => 'sometimes|boolean',
        ]);

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
            'code' => 'sometimes|string|max:64|unique:coupons,code,' . $coupon->id,
            'discount_percent' => 'sometimes|numeric|min:0|max:100',
            'expires_at' => 'nullable|date',
            'is_active' => 'sometimes|boolean',
        ]);

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
