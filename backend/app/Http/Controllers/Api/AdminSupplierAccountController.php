<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SupplierAccount;
use Illuminate\Http\Request;

class AdminSupplierAccountController extends Controller
{
    public function index(Request $request)
    {
        $query = SupplierAccount::query()->latest('id');

        if ($request->filled('platform')) {
            $query->where('platform', $request->query('platform'));
        }

        if ($request->filled('active')) {
            $query->where('is_active', $request->boolean('active'));
        }

        return response()->json([
            'data' => $query->get()->map(fn (SupplierAccount $account) => $this->transformAccount($account)),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'platform' => 'required|string|in:alibaba,aliexpress',
            'label' => 'required|string|max:255',
            'member_id' => 'nullable|string|max:255',
            'resource_owner' => 'nullable|string|max:255',
            'app_key' => 'nullable|string|max:255',
            'app_secret' => 'nullable|string',
            'access_token' => 'nullable|string',
            'refresh_token' => 'nullable|string',
            'access_token_expires_at' => 'nullable|date',
            'refresh_token_expires_at' => 'nullable|date',
            'scopes_json' => 'nullable|array',
            'country_code' => 'nullable|string|max:8',
            'currency_code' => 'nullable|string|max:8',
            'is_active' => 'sometimes|boolean',
        ]);

        $account = SupplierAccount::create($data);

        return response()->json([
            'data' => $this->transformAccount($account),
        ], 201);
    }

    public function update(Request $request, SupplierAccount $supplierAccount)
    {
        $data = $request->validate([
            'label' => 'sometimes|string|max:255',
            'member_id' => 'nullable|string|max:255',
            'resource_owner' => 'nullable|string|max:255',
            'app_key' => 'nullable|string|max:255',
            'app_secret' => 'nullable|string',
            'access_token' => 'nullable|string',
            'refresh_token' => 'nullable|string',
            'access_token_expires_at' => 'nullable|date',
            'refresh_token_expires_at' => 'nullable|date',
            'scopes_json' => 'nullable|array',
            'country_code' => 'nullable|string|max:8',
            'currency_code' => 'nullable|string|max:8',
            'is_active' => 'sometimes|boolean',
            'last_error_message' => 'nullable|string',
        ]);

        $supplierAccount->update($data);

        return response()->json([
            'data' => $this->transformAccount($supplierAccount->fresh()),
        ]);
    }

    private function transformAccount(SupplierAccount $account): array
    {
        return [
            'id' => $account->id,
            'platform' => $account->platform,
            'label' => $account->label,
            'member_id' => $account->member_id,
            'resource_owner' => $account->resource_owner,
            'app_key' => $account->app_key,
            'country_code' => $account->country_code,
            'currency_code' => $account->currency_code,
            'scopes_json' => $account->scopes_json,
            'is_active' => (bool) $account->is_active,
            'access_token_expires_at' => optional($account->access_token_expires_at)->toIso8601String(),
            'refresh_token_expires_at' => optional($account->refresh_token_expires_at)->toIso8601String(),
            'last_sync_at' => optional($account->last_sync_at)->toIso8601String(),
            'last_error_at' => optional($account->last_error_at)->toIso8601String(),
            'last_error_message' => $account->last_error_message,
            'has_app_secret' => !empty($account->app_secret),
            'has_access_token' => !empty($account->access_token),
            'has_refresh_token' => !empty($account->refresh_token),
            'created_at' => optional($account->created_at)->toIso8601String(),
            'updated_at' => optional($account->updated_at)->toIso8601String(),
        ];
    }
}