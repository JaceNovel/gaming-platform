<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\RedeemCodeDelivery;
use App\Models\Order;
use App\Models\RedeemCode;
use App\Services\AdminAuditLogger;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

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
        return response()->json($order->load(['user', 'payment', 'orderItems.product', 'orderItems.redeemDenomination', 'orderItems.redeemCode']));
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
