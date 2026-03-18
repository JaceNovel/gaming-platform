<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AliExpressTransitPricingService;
use Illuminate\Http\Request;

class StorefrontTransitController extends Controller
{
    public function __construct(private AliExpressTransitPricingService $pricingService)
    {
    }

    public function countries()
    {
        return response()->json([
            'data' => $this->pricingService->storefrontCountries(),
        ]);
    }

    public function resolve(Request $request)
    {
        $data = $request->validate([
            'country_code' => 'required|string|size:2',
        ]);

        $country = $this->pricingService->resolveCountry($data['country_code']);
        $address = $this->pricingService->defaultReceivingAddress($country);

        return response()->json([
            'data' => [
                'country' => [
                    'id' => $country->id,
                    'code' => $country->code,
                    'name' => $country->name,
                    'currency_code' => $country->currency_code,
                    'transit_provider_name' => $country->transit_provider_name,
                    'transit_city' => $country->transit_city,
                    'customer_notice' => $country->customer_notice,
                    'pricing_rules' => $country->pricing_rules_json,
                ],
                'receiving_address' => $address,
            ],
        ]);
    }
}