<?php

namespace App\Services;

use App\Exceptions\RedeemStockDepletedException;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\RedeemCode;
use App\Models\RedeemDenomination;
use Illuminate\Support\Facades\DB;

class RedeemCodeAllocator
{
    public function assignCode(RedeemDenomination $denomination, Order $order, OrderItem $orderItem): RedeemCode
    {
        return DB::transaction(function () use ($denomination, $order, $orderItem) {
            $code = RedeemCode::where('denomination_id', $denomination->id)
                ->where('status', 'available')
                ->orderBy('id')
                ->lockForUpdate()
                ->first();

            if (!$code) {
                throw RedeemStockDepletedException::forDenomination($denomination->id);
            }

            $code->update([
                'status' => 'assigned',
                'assigned_order_id' => $order->id,
                'assigned_user_id' => $order->user_id,
                'assigned_at' => now(),
                'reserved_until' => null,
            ]);

            $orderItem->update([
                'redeem_code_id' => $code->id,
                'delivery_status' => 'delivered',
                'delivery_payload' => array_merge((array) $orderItem->delivery_payload, [
                    'masked_code' => $this->maskCode($code->code),
                ]),
            ]);

            return $code->load('denomination');
        }, 5);
    }

    public function maskCode(string $code): string
    {
        $length = strlen($code);
        if ($length <= 4) {
            return str_repeat('*', $length);
        }

        $start = substr($code, 0, 4);
        $end = substr($code, -4);
        return $start . str_repeat('*', max($length - 8, 0)) . $end;
    }
}
