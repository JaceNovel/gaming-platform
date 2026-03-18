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
use App\Jobs\ProcessMarketplaceOrder;
use App\Models\MarketplaceOrder;
use App\Models\Notification;
use App\Services\AdminAuditLogger;
use App\Services\AdminResponsibilityService;
use App\Services\LoggedEmailService;
use App\Services\NotificationService;
use App\Services\ReferralCommissionService;
use App\Services\AliExpressOrderFulfillmentService;
use App\Services\WalletService;
use App\Services\ShippingService;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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
        $order->load(['user', 'payment', 'supplierAccount', 'currentSupplierFulfillment.supplierAccount', 'orderItems.product', 'orderItems.redeemDenomination', 'orderItems.redeemCode']);
        $order->setRelation('refunds', $order->refunds()->latest('id')->get());

        return response()->json($order);
    }

    public function updateAliExpressFulfillmentContext(Request $request, Order $order, AliExpressOrderFulfillmentService $service)
    {
        try {
            $data = $request->validate([
                'supplier_account_id' => 'nullable|exists:supplier_accounts,id',
                'external_order_id' => 'nullable|string|max:255',
                'seller_id' => 'nullable|string|max:255',
                'locale' => 'nullable|string|max:16',
                'invoice_customer_id' => 'nullable|string|max:255',
                'shipping_mode' => 'nullable|string|in:dbs,platform_logistics,local2local,local2local_self_pickup,local2local_offline',
                'shipping_provider_code' => 'nullable|string|max:255',
                'shipping_provider_name' => 'nullable|string|max:255',
                'carrier_code' => 'nullable|string|max:255',
                'tracking_number' => 'nullable|string|max:255',
                'package_id' => 'nullable|string|max:255',
                'pickup_address_id' => 'nullable|string|max:255',
                'refund_address_id' => 'nullable|string|max:255',
                'external_order_lines' => 'nullable|array',
            ]);

            $fulfillment = $service->saveContext($order, $data);

            return response()->json([
                'data' => $fulfillment,
                'order' => $order->fresh(['supplierAccount', 'currentSupplierFulfillment.supplierAccount']),
            ]);
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function resolveAliExpressShippingMode(Order $order, AliExpressOrderFulfillmentService $service)
    {
        try {
            $result = $service->resolveShippingMode($order);

            return response()->json([
                'data' => $result,
                'order' => $order->fresh(['supplierAccount', 'currentSupplierFulfillment.supplierAccount']),
            ]);
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function syncAliExpressRemoteOrder(Order $order, AliExpressOrderFulfillmentService $service)
    {
        try {
            $result = $service->syncRemoteOrderStatus($order);

            return response()->json([
                'data' => $result,
                'order' => $order->fresh(['supplierAccount', 'currentSupplierFulfillment.supplierAccount']),
            ]);
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function aliExpressDropshippingDraft(Order $order, AliExpressOrderFulfillmentService $service)
    {
        try {
            $draft = $service->buildDropshippingOrderDraft($order);
            $freightCheck = $service->previewDropshippingFreightCheck($order, $draft);

            return response()->json([
                'data' => [
                    'draft' => $draft,
                    'freight_check' => $freightCheck,
                ],
                'order' => $order->fresh(['supplierAccount', 'currentSupplierFulfillment.supplierAccount']),
            ]);
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function aliExpressCreateDropshippingOrder(Request $request, Order $order, AliExpressOrderFulfillmentService $service)
    {
        try {
            $data = $request->validate([
                'ds_extend_request' => 'nullable|array',
                'param_place_order_request4_open_api_d_t_o' => 'required|array',
            ]);

            $result = $service->createDropshippingOrder($order, $data);

            return response()->json([
                'data' => $result,
                'order' => $order->fresh(['supplierAccount', 'currentSupplierFulfillment.supplierAccount']),
            ]);
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function aliExpressPack(Order $order, AliExpressOrderFulfillmentService $service)
    {
        try {
            $result = $service->pack($order);

            return response()->json([
                'data' => $result,
                'order' => $order->fresh(['supplierAccount', 'currentSupplierFulfillment.supplierAccount']),
            ]);
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function aliExpressShip(Order $order, AliExpressOrderFulfillmentService $service)
    {
        try {
            $result = $service->ship($order);

            return response()->json([
                'data' => $result,
                'order' => $order->fresh(['supplierAccount', 'currentSupplierFulfillment.supplierAccount']),
            ]);
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function aliExpressRepack(Order $order, AliExpressOrderFulfillmentService $service)
    {
        try {
            $result = $service->repack($order);

            return response()->json([
                'data' => $result,
                'order' => $order->fresh(['supplierAccount', 'currentSupplierFulfillment.supplierAccount']),
            ]);
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function aliExpressPrintWaybill(Request $request, Order $order, AliExpressOrderFulfillmentService $service)
    {
        try {
            $data = $request->validate([
                'document_type' => 'nullable|string|in:WAY_BILL,PICKING_ORDER,HANDOVER,PICKING_ORDER_AND_WAY_BILL',
            ]);

            $result = $service->printWaybill($order, $data['document_type'] ?? 'WAY_BILL');

            return response()->json([
                'data' => $result,
                'order' => $order->fresh(['supplierAccount', 'currentSupplierFulfillment.supplierAccount']),
            ]);
        } catch (\Throwable $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function aliExpressQueryInvoiceRequest(Request $request, Order $order, AliExpressOrderFulfillmentService $service)
    {
        try {
            $data = $request->validate([
                'customer_id' => 'nullable|string|max:255',
            ]);

            $result = $service->queryInvoiceRequest($order, $data['customer_id'] ?? null);

            return response()->json([
                'data' => $result,
                'order' => $order->fresh(['supplierAccount', 'currentSupplierFulfillment.supplierAccount']),
            ]);
        } catch (\Throwable $exception) {
            $service->recordInvoiceFailure($order, 'query', $exception, [
                'customer_id' => $request->input('customer_id'),
            ]);

            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function aliExpressUploadBrazilInvoice(Request $request, Order $order, AliExpressOrderFulfillmentService $service)
    {
        try {
            $data = $request->validate([
                'file_name' => 'required|string|max:255',
                'file_content_base64' => 'required|string',
                'source' => 'nullable|string|max:16',
            ]);

            $result = $service->uploadBrazilInvoice(
                $order,
                (string) $data['file_name'],
                (string) $data['file_content_base64'],
                (string) ($data['source'] ?? 'ISV')
            );

            return response()->json([
                'data' => $result,
                'order' => $order->fresh(['supplierAccount', 'currentSupplierFulfillment.supplierAccount']),
            ]);
        } catch (\Throwable $exception) {
            $service->recordInvoiceFailure($order, 'upload', $exception, [
                'file_name' => $request->input('file_name'),
                'source' => $request->input('source'),
            ]);

            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function aliExpressPushInvoiceResult(Request $request, Order $order, AliExpressOrderFulfillmentService $service)
    {
        try {
            $data = $request->validate([
                'customer_id' => 'nullable|string|max:255',
                'invoice_no' => 'required|string|max:255',
                'request_no' => 'nullable|string|max:255',
                'invoice_date' => 'nullable|integer|min:1',
                'invoice_file_type' => 'required|string|in:pdf,png',
                'invoice_direction' => 'required|string|in:BLUE,RED',
                'invoice_name' => 'nullable|string|max:255',
                'invoice_content_base64' => 'required|string',
            ]);

            $result = $service->pushInvoiceResult($order, $data);

            return response()->json([
                'data' => $result,
                'order' => $order->fresh(['supplierAccount', 'currentSupplierFulfillment.supplierAccount']),
            ]);
        } catch (\Throwable $exception) {
            $service->recordInvoiceFailure($order, 'push', $exception, [
                'invoice_no' => $request->input('invoice_no'),
                'request_no' => $request->input('request_no'),
                'invoice_file_type' => $request->input('invoice_file_type'),
            ]);

            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function downloadAliExpressInvoiceDocument(Order $order, AliExpressOrderFulfillmentService $service)
    {
        $path = $service->downloadInvoiceDocument($order);
        if (!$path || !Storage::disk('public')->exists($path)) {
            abort(404, 'Document de facture introuvable.');
        }

        return Storage::disk('public')->download($path, basename($path));
    }

    public function updateStatus(Request $request, Order $order)
    {
        $data = $request->validate([
            'status' => 'required|string|max:32',
        ]);

        $order->status = strtoupper($data['status']);
        $order->save();

        if ($order->user_id) {
            $label = strtolower((string) $order->status);
            $message = match ($label) {
                'payment_success' => 'Paiement confirme. Nous preparons ta commande.',
                'payment_failed' => 'Paiement echoue. Verifie tes moyens de paiement.',
                'payment_processing' => 'Paiement en cours de verification.',
                default => 'Mise a jour du statut de commande: ' . strtoupper($label),
            };

            Notification::create([
                'user_id' => $order->user_id,
                'type' => 'order_status',
                'message' => $message,
                'is_read' => false,
            ]);
        }

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

        try {
            $front = rtrim((string) (env('FRONTEND_URL', config('app.url'))), '/');
            app(AdminResponsibilityService::class)->notify(
                'disputes_refunds',
                'admin_order_refund_issued',
                'Remboursement commande effectue',
                [
                    'headline' => 'Remboursement commande a verifier',
                    'intro' => 'Un remboursement vient d\'etre effectue sur une commande.',
                    'details' => [
                        ['label' => 'Commande', 'value' => (string) ($result['order']->reference ?? $result['order']->id)],
                        ['label' => 'Client', 'value' => (string) ($result['order']->user?->email ?? '—')],
                        ['label' => 'Montant', 'value' => number_format((float) ($result['refund']->amount ?? 0), 0, ',', ' ') . ' FCFA'],
                        ['label' => 'Type', 'value' => strtoupper((string) $refundType)],
                        ['label' => 'Motif', 'value' => (string) ($result['refund']->reason ?? $reason ?? '—')],
                    ],
                    'actionUrl' => $front . '/admin/orders/' . $result['order']->id,
                    'actionText' => 'Voir la commande',
                ],
                [
                    'order' => $result['order']->toArray(),
                    'refund' => $result['refund']->toArray(),
                    'admin' => $admin?->toArray() ?? [],
                ],
                [
                    'order_id' => $result['order']->id,
                    'refund_id' => $result['refund']->id,
                ]
            );
        } catch (\Throwable $e) {
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
                    if ($order->hasPhysicalItems()) {
                        app(\App\Services\ShippingService::class)->computeShippingForOrder($order);
                        app(\App\Services\SourcingDemandService::class)->syncForPaidOrder($order);
                    }

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

        if ($normalized === 'completed') {
            try {
                /** @var ReferralCommissionService $referrals */
                $referrals = app(ReferralCommissionService::class);
                $referrals->applyForPaidOrderId((int) $order->id, [
                    'source' => 'admin_manual_payment',
                ]);
            } catch (\Throwable $e) {
                Log::warning('admin:referral-commission-skip', [
                    'order_id' => $order->id,
                    'message' => $e->getMessage(),
                ]);
            }
        }

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

    public function generateShippingMarkDocument(Request $request, Order $order, ShippingService $shippingService)
    {
        if (!$order->hasPhysicalItems()) {
            return response()->json(['message' => 'Order has no physical items'], 422);
        }

        if (!$order->isPaymentSuccess()) {
            return response()->json(['message' => 'Order not paid'], 422);
        }

        try {
            $result = $shippingService->generateShippingMarkPdf($order);
        } catch (\Throwable) {
            return response()->json(['message' => 'Unable to generate shipping mark'], 500);
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

    public function downloadShippingMarkDocument(Request $request, Order $order)
    {
        if (!$order->shipping_mark_pdf_path) {
            return response()->json(['message' => 'Document not found'], 404);
        }

        if (!Storage::disk('public')->exists($order->shipping_mark_pdf_path)) {
            return response()->json(['message' => 'Document not found'], 404);
        }

        $path = Storage::disk('public')->path($order->shipping_mark_pdf_path);

        return response()->download($path, 'shipping-mark-'.$order->id.'.pdf');
    }

    public function updateShippingStatus(Request $request, Order $order)
    {
        $data = $request->validate([
            'shipping_status' => 'required|string|in:pending,ready_for_pickup,out_for_delivery,delivered,canceled',
        ]);

        $previous = (string) ($order->shipping_status ?? '');
        $updates = ['shipping_status' => $data['shipping_status']];
        if ($data['shipping_status'] === 'delivered') {
            $updates['delivered_at'] = now();
        }

        $order->update($updates);

        // Notify user (best-effort)
        try {
            $order->loadMissing('user');
            if ($order->user) {
                $status = (string) $data['shipping_status'];
                $labels = [
                    'pending' => 'En préparation',
                    'ready_for_pickup' => 'Prête pour retrait',
                    'out_for_delivery' => 'En cours de livraison',
                    'delivered' => 'Livrée',
                    'canceled' => 'Annulée',
                ];
                $label = $labels[$status] ?? $status;
                $message = "Mise à jour livraison ({$order->reference}) : {$label}.";

                /** @var NotificationService $notifier */
                $notifier = app(NotificationService::class);
                $notifier->notifyUser((int) $order->user_id, 'shipping_update', $message);

                $front = rtrim((string) (env('FRONTEND_URL', config('app.url'))), '/');
                $subject = 'Mise à jour de votre commande';

                $mailable = new \App\Mail\TemplatedNotification(
                    'shipping_status_updated',
                    $subject,
                    [
                        'order' => $order->toArray(),
                        'user' => $order->user->toArray(),
                        'shipping_status' => $status,
                        'shipping_status_label' => $label,
                        'shipping_status_previous' => $previous,
                    ],
                    [
                        'title' => $subject,
                        'headline' => 'Statut de livraison mis à jour',
                        'intro' => "Votre commande a été mise à jour : {$label}.",
                        'details' => [
                            ['label' => 'Référence', 'value' => (string) ($order->reference ?? $order->id)],
                            ['label' => 'Nouveau statut', 'value' => $label],
                        ],
                        'actionUrl' => $front . '/account',
                        'actionText' => 'Voir ma commande',
                    ]
                );

                /** @var LoggedEmailService $logged */
                $logged = app(LoggedEmailService::class);
                $logged->queue(
                    userId: (int) $order->user_id,
                    to: (string) ($order->user->email ?? ''),
                    type: 'shipping_status_updated',
                    subject: $subject,
                    mailable: $mailable,
                    meta: ['order_id' => $order->id, 'shipping_status' => $status]
                );
            }
        } catch (\Throwable) {
            // best-effort
        }

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

        /** @var LoggedEmailService $logged */
        $logged = app(LoggedEmailService::class);
        $logged->queue(
            userId: $order->user_id ? (int) $order->user_id : null,
            to: (string) ($order->user?->email ?? ''),
            type: 'redeem_code_resend',
            subject: 'Votre code de recharge PRIME Gaming',
            mailable: new RedeemCodeDelivery($order, $codes->all()),
            meta: ['order_id' => $order->id, 'codes_count' => $codes->count()]
        );

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
