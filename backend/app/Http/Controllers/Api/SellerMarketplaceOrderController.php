<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MarketplaceOrder;
use App\Models\Seller;
use App\Models\SellerStat;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SellerMarketplaceOrderController extends Controller
{
    public function index(Request $request)
    {
        if (!$request->user()) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }
        $seller = Seller::query()->where('user_id', $request->user()->id)->firstOrFail();

        $orders = MarketplaceOrder::query()
            ->with(['order', 'listing', 'buyer'])
            ->where('seller_id', $seller->id)
            ->orderByDesc('created_at')
            ->paginate(20);

        $orders->getCollection()->transform(function (MarketplaceOrder $row) {
            $meta = is_array($row->order?->meta) ? $row->order->meta : [];
            $buyerPhone = (string) ($meta['buyer_phone'] ?? '');
            if ($buyerPhone === '') {
                $buyerPhone = (string) ($row->buyer?->phone ?? '');
            }

            $row->setAttribute('buyer_phone', $buyerPhone ?: null);
            return $row;
        });

        return response()->json(['data' => $orders]);
    }

    public function markDelivered(Request $request, MarketplaceOrder $marketplaceOrder)
    {
        if (!$request->user()) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }
        $seller = Seller::query()->where('user_id', $request->user()->id)->firstOrFail();

        if ((int) $marketplaceOrder->seller_id !== (int) $seller->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $proof = $marketplaceOrder->delivery_proof;
        if (!is_array($proof)) {
            $proof = [];
        }
        $file = isset($proof['file']) && is_array($proof['file']) ? $proof['file'] : null;
        $hasExistingProofFile = is_array($file) && !empty($file['path']);

        $data = $request->validate([
            'note' => ['nullable', 'string', 'max:2000'],
            'proof' => [
                $hasExistingProofFile ? 'nullable' : 'required',
                'file',
                'image',
                'max:5120',
            ],
        ]);

        DB::transaction(function () use ($marketplaceOrder, $data) {
            $order = MarketplaceOrder::query()->lockForUpdate()->findOrFail($marketplaceOrder->id);

            $wasPaid = $order->status === 'paid';

            if ($order->status !== 'paid' && $order->status !== 'delivered') {
                throw ValidationException::withMessages([
                    'status' => ['Order is not deliverable.'],
                ]);
            }

            $proof = $order->delivery_proof ?? [];
            if (!is_array($proof)) {
                $proof = [];
            }

            if (!empty($data['note'])) {
                $proof['note'] = $data['note'];
            }

            if (!empty($data['proof'])) {
                $file = $data['proof'];
                $dir = "marketplace/deliveries/seller_{$order->seller_id}/order_{$order->id}";
                $name = 'proof_' . now()->format('Ymd_His') . '.' . $file->getClientOriginalExtension();
                $path = $file->storeAs($dir, $name, ['disk' => 'local']);
                $proof['file'] = [
                    'disk' => 'local',
                    'path' => $path,
                    'mime' => $file->getMimeType(),
                    'size' => $file->getSize(),
                ];
            }

            $file = isset($proof['file']) && is_array($proof['file']) ? $proof['file'] : null;
            $hasFile = is_array($file) && !empty($file['path']);
            if (!$hasFile) {
                throw ValidationException::withMessages([
                    'proof' => ['Une preuve (image) est obligatoire pour marquer comme livré.'],
                ]);
            }

            $order->status = 'delivered';
            $order->delivered_at = $order->delivered_at ?? now();
            $order->delivery_proof = $proof;
            $order->save();

            if ($wasPaid) {
                $stats = SellerStat::query()->where('seller_id', $order->seller_id)->lockForUpdate()->first();
                if ($stats) {
                    $stats->successful_sales = (int) $stats->successful_sales + 1;
                    $stats->last_sale_at = now();
                    $stats->save();
                }
            }
        });

        return response()->json(['ok' => true]);
    }
}
