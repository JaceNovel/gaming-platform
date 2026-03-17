<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SupplierCountry;
use App\Models\SupplierReceivingAddress;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminSupplierReceivingAddressController extends Controller
{
    public function index(Request $request)
    {
        $query = SupplierReceivingAddress::query()
            ->with('country:id,platform,code,name')
            ->latest('id');

        if ($request->filled('platform')) {
            $query->where('platform', $request->query('platform'));
        }

        if ($request->filled('supplier_country_id')) {
            $query->where('supplier_country_id', $request->query('supplier_country_id'));
        }

        if ($request->filled('active')) {
            $query->where('is_active', $request->boolean('active'));
        }

        return response()->json([
            'data' => $query->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request);
        $country = SupplierCountry::query()->findOrFail((int) $data['supplier_country_id']);
        $this->assertPlatformMatchesCountry($data['platform'], $country);

        $address = DB::transaction(function () use ($data) {
            if (!empty($data['is_default'])) {
                SupplierReceivingAddress::query()
                    ->where('platform', $data['platform'])
                    ->where('supplier_country_id', $data['supplier_country_id'])
                    ->update(['is_default' => false]);
            }

            return SupplierReceivingAddress::create($data);
        });

        return response()->json(['data' => $address->load('country:id,platform,code,name')], 201);
    }

    public function update(Request $request, SupplierReceivingAddress $supplierReceivingAddress)
    {
        $data = $this->validatePayload($request, true);
        $countryId = (int) ($data['supplier_country_id'] ?? $supplierReceivingAddress->supplier_country_id);
        $platform = (string) ($data['platform'] ?? $supplierReceivingAddress->platform);
        $country = SupplierCountry::query()->findOrFail($countryId);
        $this->assertPlatformMatchesCountry($platform, $country);

        $address = DB::transaction(function () use ($data, $supplierReceivingAddress, $countryId, $platform) {
            if (!empty($data['is_default'])) {
                SupplierReceivingAddress::query()
                    ->where('platform', $platform)
                    ->where('supplier_country_id', $countryId)
                    ->whereKeyNot($supplierReceivingAddress->id)
                    ->update(['is_default' => false]);
            }

            $supplierReceivingAddress->update($data);

            return $supplierReceivingAddress;
        });

        return response()->json(['data' => $address->fresh()->load('country:id,platform,code,name')]);
    }

    public function destroy(SupplierReceivingAddress $supplierReceivingAddress)
    {
        $supplierReceivingAddress->delete();

        return response()->json(['message' => 'Adresse supprimée.']);
    }

    private function validatePayload(Request $request, bool $partial = false): array
    {
        $rules = [
            'supplier_country_id' => [$partial ? 'sometimes' : 'required', 'integer', 'exists:supplier_countries,id'],
            'platform' => [$partial ? 'sometimes' : 'required', 'string', 'in:alibaba,aliexpress'],
            'recipient_name' => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            'address_line1' => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            'address_line2' => ['nullable', 'string', 'max:255'],
            'city' => [$partial ? 'sometimes' : 'required', 'string', 'max:120'],
            'postal_code' => ['nullable', 'string', 'max:32'],
            'phone' => [$partial ? 'sometimes' : 'required', 'string', 'max:64'],
            'shipping_mark' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'is_default' => ['sometimes', 'boolean'],
        ];

        return $request->validate($rules);
    }

    private function assertPlatformMatchesCountry(string $platform, SupplierCountry $country): void
    {
        if ($country->platform !== $platform) {
            abort(422, 'Le pays sélectionné n’appartient pas à cette plateforme.');
        }
    }
}