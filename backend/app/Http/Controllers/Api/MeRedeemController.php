<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RedeemCode;
use App\Models\RedeemCodeDelivery;
use Illuminate\Http\Request;

class MeRedeemController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $perPage = $request->integer('per_page', 30);
        $perPage = max(1, min($perPage, 100));

        $query = RedeemCodeDelivery::query()
            ->with([
                'redeemCode.denomination.product:id,name,sku',
                'order:id,reference,status,created_at',
            ])
            ->where('user_id', $user->id)
            ->latest('id');

        $paginator = $query->paginate($perPage);

        $deliveryIds = $paginator->getCollection()->pluck('id')->all();
        $codeIds = $paginator->getCollection()->pluck('redeem_code_id')->filter()->values()->all();

        if (!empty($deliveryIds)) {
            RedeemCodeDelivery::whereIn('id', $deliveryIds)
                ->where('delivered_via', 'email')
                ->update(['delivered_via' => 'both']);
        }

        if (!empty($codeIds)) {
            RedeemCode::whereIn('id', $codeIds)
                ->whereNull('revealed_at')
                ->update(['revealed_at' => now()]);
        }

        $paginator->getCollection()->transform(function (RedeemCodeDelivery $delivery) {
            $code = $delivery->redeemCode;

            return [
                'id' => $delivery->id,
                'created_at' => $delivery->created_at,
                'order' => [
                    'id' => $delivery->order_id,
                    'reference' => $delivery->order?->reference,
                    'status' => $delivery->order?->status,
                    'created_at' => $delivery->order?->created_at,
                ],
                'product' => [
                    'id' => $delivery->product_id,
                    'name' => $code?->denomination?->product?->name,
                    'sku' => $code?->denomination?->product?->sku,
                ],
                'denomination' => [
                    'id' => $code?->denomination_id,
                    'label' => $code?->denomination?->label,
                    'diamonds' => $code?->denomination?->diamonds,
                ],
                'code' => $code?->code,
                'quantity_index' => $delivery->quantity_index,
                'delivered_via' => $delivery->delivered_via,
            ];
        });

        return response()->json($paginator);
    }
}
