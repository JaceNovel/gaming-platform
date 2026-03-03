<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\TemplatedNotification;
use App\Models\MarketplaceOrder;
use App\Models\Seller;
use App\Models\SellerStat;
use App\Services\LoggedEmailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class SellerMarketplaceOrderController extends Controller
{
    private function publicUploadsDiskName(): string
    {
        $diskName = (string) (config('filesystems.public_uploads_disk') ?: 'public');
        return $diskName !== '' ? $diskName : 'public';
    }

    private function frontendUrl(string $path = ''): string
    {
        $base = rtrim((string) (env('FRONTEND_URL', config('app.url'))), '/');
        $p = '/' . ltrim($path, '/');
        return $base . ($path !== '' ? $p : '');
    }

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

                $diskName = $this->publicUploadsDiskName();
                $path = $file->storeAs($dir, $name, [
                    'disk' => $diskName,
                    'visibility' => 'public',
                ]);

                // Best-effort cleanup of previous file if replaced.
                $existingFile = isset($proof['file']) && is_array($proof['file']) ? $proof['file'] : null;
                $existingPath = is_array($existingFile) ? (string) ($existingFile['path'] ?? '') : '';
                $existingDisk = is_array($existingFile)
                    ? (string) ($existingFile['disk'] ?? $diskName)
                    : $diskName;
                if ($existingPath !== '' && ($existingPath !== $path || $existingDisk !== $diskName)) {
                    try {
                        Storage::disk($existingDisk)->delete($existingPath);
                    } catch (\Throwable $e) {
                    }
                }

                $proof['file'] = [
                    'disk' => $diskName,
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

        // Email buyer (best-effort)
        try {
            $fresh = MarketplaceOrder::query()->with(['order', 'buyer', 'listing'])->find($marketplaceOrder->id);
            $buyer = $fresh?->buyer;
            if ($fresh && $buyer && $buyer->email) {
                $subject = 'Commande marquée livrée - Marketplace';
                $orderRef = (string) ($fresh->order?->reference ?? $fresh->order_id);
                $listingTitle = (string) ($fresh->listing?->title ?? 'Compte Gaming');

                $mailable = new TemplatedNotification(
                    'marketplace_order_delivered_buyer',
                    $subject,
                    [
                        'marketplaceOrder' => $fresh->toArray(),
                        'order' => $fresh->order?->toArray() ?? [],
                        'user' => $buyer->toArray(),
                    ],
                    [
                        'title' => $subject,
                        'headline' => 'Livraison annoncée',
                        'intro' => 'Le vendeur a marqué ta commande comme livrée. Si tout est OK, confirme la livraison.',
                        'details' => [
                            ['label' => 'Référence', 'value' => $orderRef],
                            ['label' => 'Annonce', 'value' => $listingTitle],
                        ],
                        'actionUrl' => $this->frontendUrl('/account'),
                        'actionText' => 'Ouvrir mon compte',
                    ]
                );

                /** @var LoggedEmailService $logged */
                $logged = app(LoggedEmailService::class);
                $logged->queue($buyer->id, $buyer->email, 'marketplace_order_delivered_buyer', $subject, $mailable, [
                    'marketplace_order_id' => $fresh->id,
                ]);
            }
        } catch (\Throwable $e) {
        }

        return response()->json(['ok' => true]);
    }
}
