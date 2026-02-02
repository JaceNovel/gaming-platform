<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\RedeemCodeDelivery;
use App\Models\Order;
use App\Models\RedeemCode;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Refund;
use App\Jobs\ProcessOrderDelivery;
use App\Jobs\ProcessRedeemFulfillment;
use App\Services\AdminAuditLogger;
use App\Services\WalletService;
use App\Services\ShippingService;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AdminOrderController extends Controller
{
    public function index(Request $request)
    {
        $query = Order::with(['user', 'payment', 'orderItems.product', 'orderItems.redeemDenomination', 'orderItems.redeemCode'])
            ->latest('id');

        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->query('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->query('to'));
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($reference = $request->query('reference')) {
            $query->where('reference', 'like', "%{$reference}%");
        }

        if ($request->filled('email')) {
            $email = $request->query('email');
            $query->whereHas('user', fn ($q) => $q->where('email', 'like', "%{$email}%"));
        }

        if ($paymentStatus = $request->query('payment_status')) {
            $query->whereHas('payment', fn ($q) => $q->where('status', $paymentStatus));
        }

        if ($country = $request->query('country')) {
            $query->whereHas('user', fn ($q) => $q->where('country_code', $country));
        }

        if ($productType = $request->query('product_type')) {
            $query->whereHas('orderItems.product', fn ($q) => $q->where('type', $productType));
        }

        $perPage = $request->integer('per_page', 30);

        return response()->json($query->paginate($perPage));
    }

    public function recent(Request $request)
    {
        $limit = $request->integer('limit', 10);

        $orders = Order::with(['user', 'payment', 'orderItems.product'])
            ->latest('id')
            ->limit(min($limit, 50))
            ->get()
            ->map(function (Order $order) {
                return [
                    'order_id' => $order->id,
                    'reference' => $order->reference,
                    'customer' => [
                        'name' => $order->user?->name,
                        'email' => $order->user?->email,
                    ],
                    'products' => $order->orderItems->map(fn ($item) => $item->product?->name)->filter()->values(),
                    'date' => $order->created_at?->toIso8601String(),
                    'amount' => (float) $order->total_price,
                    'status' => $order->status,
                    'payment_status' => $order->payment?->status,
                ];
            });

        return response()->json([
            'data' => $orders,
        ]);
    }

    public function show(Order $order)
    {
        $order->load(['user', 'payment', 'orderItems.product', 'orderItems.redeemDenomination', 'orderItems.redeemCode']);
        $order->setRelation('refunds', $order->refunds()->latest('id')->get());

        return response()->json($order);
    }

    public function updateStatus(Request $request, Order $order)
    {
        $data = $request->validate([
            'status' => 'required|string|max:32',
        ]);

        $order->status = strtoupper($data['status']);
        $order->save();

        return response()->json(['order' => $order]);
    }

    public function refund(Request $request, Order $order, WalletService $walletService, AdminAuditLogger $auditLogger)
    {
        $admin = $request->user();

        $data = $request->validate([
            'type' => ['required', 'string', 'in:full,partial'],
            'amount' => ['nullable', 'numeric', 'min:1'],
            'reason' => ['nullable', 'string', 'max:255'],
            'reference' => ['nullable', 'string', 'max:80'],
            'confirm' => ['accepted'],
        ]);

        $refundType = strtolower((string) $data['type']);
        $reason = array_key_exists('reason', $data) ? $data['reason'] : null;
        $reference = trim((string) ($data['reference'] ?? ''));
        if ($reference === '') {
            $reference = null;
        }

        $result = DB::transaction(function () use ($order, $refundType, $data, $reason, $reference, $walletService, $admin) {
            /** @var Order $lockedOrder */
            $lockedOrder = Order::with(['user'])->where('id', $order->id)->lockForUpdate()->firstOrFail();

            if (!$lockedOrder->user) {
                throw ValidationException::withMessages(['order' => 'Order user not found']);
            }

            if (!$lockedOrder->isPaymentSuccess()) {
                throw ValidationException::withMessages(['order' => 'Refund allowed only for paid orders']);
            }

            $paidAmount = (float) ($lockedOrder->total_price ?? 0);
            if (!is_finite($paidAmount) || $paidAmount <= 0) {
                throw ValidationException::withMessages(['order' => 'Invalid paid amount']);
            }

            $refundedAmount = (float) ($lockedOrder->refunded_amount ?? 0);
            if (!is_finite($refundedAmount) || $refundedAmount < 0) {
                $refundedAmount = 0;
            }

            $remaining = max(0.0, $paidAmount - $refundedAmount);
            if ($remaining <= 0.0001) {
                throw ValidationException::withMessages(['order' => 'Order already fully refunded']);
            }

            if ($refundType === 'full') {
                $amount = $remaining;
            } else {
                $amount = (float) ($data['amount'] ?? 0);
                if (!is_finite($amount) || $amount <= 0) {
                    throw ValidationException::withMessages(['amount' => 'Invalid amount']);
                }
                if ($amount + 0.0001 > $remaining) {
                    throw ValidationException::withMessages(['amount' => 'Amount exceeds refundable remaining']);
                }
                if ($amount + 0.0001 >= $remaining) {
                    throw ValidationException::withMessages(['amount' => 'Use full refund for the remaining amount']);
                }
            }

            $refundReference = $reference ?? ('RFD-' . $lockedOrder->id . '-' . now()->format('YmdHis') . '-' . Str::upper(Str::random(6)));

            $refund = Refund::where('reference', $refundReference)->first();
            if (!$refund) {
                $refund = Refund::create([
                    'order_id' => $lockedOrder->id,
                    'user_id' => $lockedOrder->user->id,
                    'amount' => $amount,
                    'reference' => $refundReference,
                    'reason' => $reason,
                    'status' => 'success',
                ]);
            }

            $walletReference = 'REFUND-' . $refundReference;
            $walletTx = $walletService->credit($lockedOrder->user, $walletReference, $amount, [
                'reason' => 'refund',
                'type' => 'order_refund',
                'order_id' => $lockedOrder->id,
                'refund_id' => $refund->id,
                'refund_reference' => $refundReference,
                'admin_id' => $admin?->id,
            ]);

            $newRefundedAmount = $refundedAmount + $amount;
            if ($newRefundedAmount + 0.0001 >= $paidAmount) {
                $lockedOrder->refunded_amount = $paidAmount;
                $lockedOrder->status_refund = 'full';
                $lockedOrder->refunded_at = $lockedOrder->refunded_at ?? now();
            } else {
                $lockedOrder->refunded_amount = $newRefundedAmount;
                $lockedOrder->status_refund = $newRefundedAmount > 0 ? 'partial' : 'none';
                $lockedOrder->refunded_at = null;
            }
            $lockedOrder->save();

            return [
                'order' => $lockedOrder->fresh(['user', 'payment', 'orderItems.product', 'orderItems.redeemDenomination', 'orderItems.redeemCode']),
                'refund' => $refund,
                'wallet_transaction' => $walletTx,
                'refunds' => Refund::where('order_id', $lockedOrder->id)->latest('id')->get(),
            ];
        });

        if ($admin) {
            $auditLogger->log(
                $admin,
                'order_refund',
                [
                    'order_id' => $result['order']->id,
                    'user_id' => $result['order']->user_id,
                    'refund_id' => $result['refund']->id,
                    'refund_reference' => $result['refund']->reference,
                    'amount' => (float) $result['refund']->amount,
                    'reason' => $result['refund']->reason,
                ],
                'refund',
                $request
            );
        }

        return response()->json([
            'success' => true,
            'order' => $result['order'],
            'refund' => $result['refund'],
            'refunds' => $result['refunds'],
        ]);
    }

    public function updatePaymentStatus(Request $request, Order $order, AdminAuditLogger $auditLogger)
    {
        $data = $request->validate([
            'status' => 'required|string|in:completed,failed',
        ]);

        if ((string) ($order->type ?? '') === 'wallet_topup') {
            return response()->json(['message' => 'Manual validation disabled for wallet topup'], 422);
        }

        $normalized = strtolower($data['status']);

        DB::transaction(function () use ($order, $normalized) {
            $order->loadMissing(['orderItems.product', 'payment']);

            $payment = $order->payment;
            if (!$payment) {
                $payment = Payment::create([
                    'order_id' => $order->id,
                    'amount' => (float) ($order->total_price ?? 0),
                    'method' => 'manual',
                    'status' => $normalized,
                    'transaction_id' => 'manual-' . $order->id . '-' . now()->timestamp,
                ]);
                $order->update(['payment_id' => $payment->id]);
            } else {
                $payment->update(['status' => $normalized]);
            }

            if ($normalized === 'completed') {
                $order->update(['status' => Order::STATUS_PAYMENT_SUCCESS]);
            } else {
                $order->update(['status' => Order::STATUS_PAYMENT_FAILED]);
            }

            if ($normalized === 'completed') {
                $orderMeta = $order->meta ?? [];
                if (!is_array($orderMeta)) {
                    $orderMeta = [];
                }

                if (empty($orderMeta['sales_recorded_at'])) {
                    foreach ($order->orderItems as $item) {
                        if (!$item?->product_id) {
                            continue;
                        }
                        $qty = max(1, (int) ($item->quantity ?? 1));
                        Product::where('id', $item->product_id)->increment('purchases_count');
                        Product::where('id', $item->product_id)->increment('sold_count', $qty);
                    }
                    $orderMeta['sales_recorded_at'] = now()->toIso8601String();
                }

                if (empty($orderMeta['fulfillment_dispatched_at']) && $order->canBeFulfilled()) {
                    if ($order->requiresRedeemFulfillment()) {
                        ProcessRedeemFulfillment::dispatchSync($order->id);
                    } else {
                        ProcessOrderDelivery::dispatchSync($order);
                    }
                    $orderMeta['fulfillment_dispatched_at'] = now()->toIso8601String();
                }

                $order->update(['meta' => $orderMeta]);
            }
        });

        $auditLogger->log(
            $request->user(),
            'order_payment_status',
            [
                'order_id' => $order->id,
                'status' => $normalized,
            ],
            actionType: 'payments',
            request: $request
        );

        return response()->json(['order' => $order->fresh(['payment'])]);
    }

    public function deliveryNotePdf(Order $order)
    {
        $order->load(['user', 'orderItems.product']);

        $html = view('delivery-note', ['order' => $order])->render();

        $options = new Options();
        $options->set('isRemoteEnabled', true);
        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4');
        $dompdf->render();

        return response($dompdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="delivery-note-'.$order->id.'.pdf"',
        ]);
    }

    public function generateShippingDocument(Request $request, Order $order, ShippingService $shippingService)
    {
        if (!$order->hasPhysicalItems()) {
            return response()->json(['message' => 'Order has no physical items'], 422);
        }

        if (!$order->isPaymentSuccess()) {
            return response()->json(['message' => 'Order not paid'], 422);
        }

        try {
            $result = $shippingService->generateDeliveryNotePdf($order);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Unable to generate document'], 500);
        }

        return response()->json([
            'data' => [
                'path' => $result['path'],
                'url' => $result['url'],
            ],
        ]);
    }

    public function downloadShippingDocument(Request $request, Order $order)
    {
        if (!$order->shipping_document_path) {
            return response()->json(['message' => 'Document not found'], 404);
        }

        if (!Storage::disk('public')->exists($order->shipping_document_path)) {
            return response()->json(['message' => 'Document not found'], 404);
        }

        $path = Storage::disk('public')->path($order->shipping_document_path);

        return response()->download($path, 'bon-livraison-'.$order->id.'.pdf');
    }

    public function updateShippingStatus(Request $request, Order $order)
    {
        $data = $request->validate([
            'shipping_status' => 'required|string|in:pending,ready_for_pickup,out_for_delivery,delivered,canceled',
        ]);

        $updates = ['shipping_status' => $data['shipping_status']];
        if ($data['shipping_status'] === 'delivered') {
            $updates['delivered_at'] = now();
        }

        $order->update($updates);

        return response()->json(['data' => $order->fresh()]);
    }

    public function resendCode(Request $request, Order $order, AdminAuditLogger $auditLogger)
    {
        $order->load(['user', 'orderItems.redeemDenomination']);

        if (!$order->requiresRedeemFulfillment()) {
            return response()->json(['message' => 'Order does not contain redeem codes'], 422);
        }

        $codes = RedeemCode::where('assigned_order_id', $order->id)->get();

        if ($codes->isEmpty()) {
            return response()->json(['message' => 'No codes assigned'], 404);
        }

        Mail::to($order->user->email)->queue(new RedeemCodeDelivery($order, $codes->all()));

        RedeemCode::whereIn('id', $codes->pluck('id')->all())->update(['last_resend_at' => now()]);

        \App\Models\EmailLog::create([
            'user_id' => $order->user_id,
            'to' => $order->user->email,
            'type' => 'redeem_code_resend',
            'subject' => 'Votre code de recharge BADBOYSHOP',
            'status' => 'queued',
            'sent_at' => now(),
        ]);

        $auditLogger->log(
            $request->user(),
            'redeem_resend',
            [
                'message' => 'Resent redeem codes',
                'order_id' => $order->id,
                'codes' => $codes->pluck('id')->all(),
            ],
            actionType: 'redeem_fulfillment',
            request: $request
        );

        return response()->json(['message' => 'Codes resent']);
    }
}
