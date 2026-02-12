<?php

namespace App\Services;

use App\Models\Dispute;
use App\Models\MarketplaceOrder;
use App\Models\Order;
use App\Models\PartnerWithdrawRequest;
use App\Models\PaymentAttempt;
use App\Models\PhoneChangeRequest;
use App\Models\RedeemStockAlert;
use App\Models\Refund;
use App\Models\Seller;
use App\Models\SellerListing;
use App\Models\StockMovement;
use App\Models\SupportTicket;
use App\Models\User;
use Carbon\Carbon;

class AdminActivityService
{
    /**
     * @return array{counts: array<string,int>, items: array<int, array<string,mixed>>}
     */
    public function recentForUser(User $user, Carbon $since, int $limit = 12): array
    {
        $limit = max(1, min(30, (int) $limit));

        $events = [];
        $counts = [
            'orders' => 0,
            'users' => 0,
            'marketplace_orders' => 0,
            'support' => 0,
            'marketplace_disputes' => 0,
            'marketplace_sellers_kyc' => 0,
            'marketplace_listings' => 0,
            'marketplace_withdraws' => 0,
            'payments_failed' => 0,
            'refunds' => 0,
            'phone_change_requests' => 0,
            'stock_movements' => 0,
            'redeem_low_stock' => 0,
        ];

        $addEvent = function (array $event) use (&$events) {
            if (empty($event['key']) || empty($event['type']) || empty($event['title'])) {
                return;
            }
            $events[] = $event;
        };

        if ($user->hasPermission('orders.view')) {
            $orders = Order::query()
                ->where('created_at', '>', $since)
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get(['id', 'reference', 'status', 'total_price', 'currency', 'created_at']);

            $counts['orders'] = Order::query()->where('created_at', '>', $since)->count();

            foreach ($orders as $o) {
                $ref = (string) ($o->reference ?? ('#' . $o->id));
                $addEvent([
                    'key' => 'order:' . $o->id,
                    'type' => 'order',
                    'id' => (int) $o->id,
                    'title' => 'Nouvelle commande ' . $ref,
                    'created_at' => optional($o->created_at)->toIso8601String(),
                    'href' => '/admin/orders/' . $o->id,
                    'meta' => [
                        'status' => $o->status,
                        'amount' => (float) ($o->total_price ?? 0),
                        'currency' => (string) ($o->currency ?? 'XOF'),
                    ],
                ]);
            }
        }

        if ($user->hasPermission('users.view')) {
            $users = User::query()
                ->where('role', 'user')
                ->where('email', 'not like', 'likebot+%@badboyshop.local')
                ->where('created_at', '>', $since)
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get(['id', 'name', 'email', 'created_at']);

            $counts['users'] = User::query()
                ->where('role', 'user')
                ->where('email', 'not like', 'likebot+%@badboyshop.local')
                ->where('created_at', '>', $since)
                ->count();

            foreach ($users as $u) {
                $name = (string) ($u->name ?? $u->email ?? ('User #' . $u->id));
                $addEvent([
                    'key' => 'user:' . $u->id,
                    'type' => 'user',
                    'id' => (int) $u->id,
                    'title' => 'Nouvelle inscription: ' . $name,
                    'created_at' => optional($u->created_at)->toIso8601String(),
                    'href' => '/admin/users/' . $u->id,
                    'meta' => [
                        'email' => (string) ($u->email ?? ''),
                    ],
                ]);
            }
        }

        if ($user->hasPermission('marketplace.orders.manage')) {
            $mp = MarketplaceOrder::query()
                ->where('created_at', '>', $since)
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get(['id', 'status', 'price', 'created_at']);

            $counts['marketplace_orders'] = MarketplaceOrder::query()->where('created_at', '>', $since)->count();

            foreach ($mp as $o) {
                $addEvent([
                    'key' => 'marketplace_order:' . $o->id,
                    'type' => 'marketplace_order',
                    'id' => (int) $o->id,
                    'title' => 'Nouvelle commande marketplace #' . $o->id,
                    'created_at' => optional($o->created_at)->toIso8601String(),
                    'href' => '/admin/marketplace/orders',
                    'meta' => [
                        'status' => $o->status,
                        'amount' => (float) ($o->price ?? 0),
                        'currency' => 'XOF',
                    ],
                ]);
            }
        }

        if ($user->hasPermission('support.view')) {
            $tickets = SupportTicket::query()
                ->withCount(['messages as unread_count' => function ($q) {
                    $q->where('from_admin', false)->where('is_read', false);
                }])
                ->where('last_message_at', '>', $since)
                ->having('unread_count', '>', 0)
                ->orderByDesc('last_message_at')
                ->limit($limit)
                ->get(['id', 'subject', 'status', 'priority', 'last_message_at', 'created_at']);

            $counts['support'] = SupportTicket::query()
                ->whereHas('messages', function ($q) use ($since) {
                    $q->where('from_admin', false)->where('is_read', false)->where('created_at', '>', $since);
                })
                ->count();

            foreach ($tickets as $t) {
                $subject = trim((string) ($t->subject ?? ''));
                $suffix = $subject ? (' — ' . $subject) : '';
                $unread = (int) ($t->unread_count ?? 0);
                $addEvent([
                    'key' => 'support_ticket:' . $t->id,
                    'type' => 'support_ticket',
                    'id' => (int) $t->id,
                    'title' => 'Support: ' . $unread . ' message(s) non lu(s) — #' . $t->id . $suffix,
                    'created_at' => optional($t->last_message_at ?: $t->created_at)->toIso8601String(),
                    'href' => '/admin/dashboard',
                    'meta' => [
                        'status' => $t->status,
                        'priority' => $t->priority,
                        'unread_count' => $unread,
                    ],
                ]);
            }
        }

        if ($user->hasPermission('marketplace.disputes.manage')) {
            $disputes = Dispute::query()
                ->where('created_at', '>', $since)
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get(['id', 'status', 'reason', 'marketplace_order_id', 'created_at', 'opened_at']);

            $counts['marketplace_disputes'] = Dispute::query()->where('created_at', '>', $since)->count();

            foreach ($disputes as $d) {
                $when = $d->opened_at ?: $d->created_at;
                $addEvent([
                    'key' => 'marketplace_dispute:' . $d->id,
                    'type' => 'marketplace_dispute',
                    'id' => (int) $d->id,
                    'title' => 'Nouveau litige marketplace #' . $d->id,
                    'created_at' => optional($when)->toIso8601String(),
                    'href' => '/admin/marketplace/disputes',
                    'meta' => [
                        'status' => $d->status,
                        'marketplace_order_id' => $d->marketplace_order_id,
                        'reason' => $d->reason,
                    ],
                ]);
            }
        }

        if ($user->hasPermission('marketplace.sellers.view')) {
            $sellers = Seller::query()
                ->whereNotNull('kyc_submitted_at')
                ->where('kyc_submitted_at', '>', $since)
                ->orderByDesc('kyc_submitted_at')
                ->limit($limit)
                ->get(['id', 'user_id', 'status', 'kyc_full_name', 'kyc_submitted_at']);

            $counts['marketplace_sellers_kyc'] = Seller::query()
                ->whereNotNull('kyc_submitted_at')
                ->where('kyc_submitted_at', '>', $since)
                ->count();

            foreach ($sellers as $s) {
                $name = trim((string) ($s->kyc_full_name ?? ''));
                $label = $name ? $name : ('Vendeur #' . $s->id);
                $addEvent([
                    'key' => 'seller_kyc:' . $s->id,
                    'type' => 'seller_kyc',
                    'id' => (int) $s->id,
                    'title' => 'KYC vendeur soumis: ' . $label,
                    'created_at' => optional($s->kyc_submitted_at)->toIso8601String(),
                    'href' => '/admin/marketplace/sellers',
                    'meta' => [
                        'status' => $s->status,
                        'user_id' => $s->user_id,
                    ],
                ]);
            }
        }

        if ($user->hasPermission('marketplace.listings.manage')) {
            $listings = SellerListing::query()
                ->where('status', 'pending_review')
                ->whereNotNull('submitted_at')
                ->where('submitted_at', '>', $since)
                ->orderByDesc('submitted_at')
                ->limit($limit)
                ->get(['id', 'seller_id', 'title', 'price', 'currency', 'status', 'submitted_at']);

            $counts['marketplace_listings'] = SellerListing::query()
                ->where('status', 'pending_review')
                ->whereNotNull('submitted_at')
                ->where('submitted_at', '>', $since)
                ->count();

            foreach ($listings as $l) {
                $title = trim((string) ($l->title ?? ''));
                $label = $title ? $title : ('Annonce #' . $l->id);
                $addEvent([
                    'key' => 'marketplace_listing:' . $l->id,
                    'type' => 'marketplace_listing',
                    'id' => (int) $l->id,
                    'title' => 'Annonce à valider: ' . $label,
                    'created_at' => optional($l->submitted_at)->toIso8601String(),
                    'href' => '/admin/marketplace/listings',
                    'meta' => [
                        'status' => $l->status,
                        'seller_id' => $l->seller_id,
                        'amount' => (float) ($l->price ?? 0),
                        'currency' => (string) ($l->currency ?? 'XOF'),
                    ],
                ]);
            }
        }

        if ($user->hasPermission('marketplace.withdraws.manage')) {
            $withdraws = PartnerWithdrawRequest::query()
                ->where('status', 'requested')
                ->where('created_at', '>', $since)
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get(['id', 'seller_id', 'amount', 'status', 'created_at']);

            $counts['marketplace_withdraws'] = PartnerWithdrawRequest::query()
                ->where('status', 'requested')
                ->where('created_at', '>', $since)
                ->count();

            foreach ($withdraws as $w) {
                $addEvent([
                    'key' => 'marketplace_withdraw:' . $w->id,
                    'type' => 'marketplace_withdraw',
                    'id' => (int) $w->id,
                    'title' => 'Retrait vendeur demandé #' . $w->id,
                    'created_at' => optional($w->created_at)->toIso8601String(),
                    'href' => '/admin/marketplace/withdraws',
                    'meta' => [
                        'status' => $w->status,
                        'seller_id' => $w->seller_id,
                        'amount' => (float) ($w->amount ?? 0),
                        'currency' => 'XOF',
                    ],
                ]);
            }
        }

        if ($user->hasPermission('payments.view')) {
            $attempts = PaymentAttempt::query()
                ->where('status', 'failed')
                ->where(function ($q) use ($since) {
                    $q->where('processed_at', '>', $since)->orWhere('created_at', '>', $since);
                })
                ->orderByDesc('processed_at')
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get(['id', 'order_id', 'amount', 'currency', 'status', 'provider', 'transaction_id', 'processed_at', 'created_at']);

            $counts['payments_failed'] = PaymentAttempt::query()
                ->where('status', 'failed')
                ->where(function ($q) use ($since) {
                    $q->where('processed_at', '>', $since)->orWhere('created_at', '>', $since);
                })
                ->count();

            foreach ($attempts as $a) {
                $when = $a->processed_at ?: $a->created_at;
                $orderId = (int) ($a->order_id ?? 0);
                $addEvent([
                    'key' => 'payment_attempt:' . $a->id,
                    'type' => 'payment_failed',
                    'id' => (int) $a->id,
                    'title' => $orderId ? ('Paiement échoué: commande #' . $orderId) : ('Paiement échoué: tx ' . (string) ($a->transaction_id ?? '')),
                    'created_at' => optional($when)->toIso8601String(),
                    'href' => '/admin/payments',
                    'meta' => [
                        'order_id' => $a->order_id,
                        'provider' => $a->provider,
                        'amount' => (float) ($a->amount ?? 0),
                        'currency' => (string) ($a->currency ?? 'XOF'),
                        'transaction_id' => $a->transaction_id,
                    ],
                ]);
            }
        }

        if ($user->hasPermission('orders.view')) {
            $refunds = Refund::query()
                ->where('created_at', '>', $since)
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get(['id', 'order_id', 'user_id', 'amount', 'reference', 'reason', 'status', 'created_at']);

            $counts['refunds'] = Refund::query()->where('created_at', '>', $since)->count();

            foreach ($refunds as $r) {
                $ref = trim((string) ($r->reference ?? ''));
                $title = $ref ? ('Remboursement: ' . $ref) : ('Remboursement #' . $r->id);
                $href = $r->order_id ? ('/admin/orders/' . $r->order_id) : '/admin/orders';
                $addEvent([
                    'key' => 'refund:' . $r->id,
                    'type' => 'refund',
                    'id' => (int) $r->id,
                    'title' => $title,
                    'created_at' => optional($r->created_at)->toIso8601String(),
                    'href' => $href,
                    'meta' => [
                        'status' => $r->status,
                        'order_id' => $r->order_id,
                        'user_id' => $r->user_id,
                        'amount' => (float) ($r->amount ?? 0),
                    ],
                ]);
            }
        }

        if ($user->hasPermission('users.view')) {
            $rows = PhoneChangeRequest::query()
                ->where('status', 'pending')
                ->where('created_at', '>', $since)
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get(['id', 'user_id', 'old_phone', 'new_phone', 'status', 'created_at']);

            $counts['phone_change_requests'] = PhoneChangeRequest::query()
                ->where('status', 'pending')
                ->where('created_at', '>', $since)
                ->count();

            foreach ($rows as $p) {
                $addEvent([
                    'key' => 'phone_change_request:' . $p->id,
                    'type' => 'phone_change_request',
                    'id' => (int) $p->id,
                    'title' => 'Demande changement téléphone: User #' . (int) $p->user_id,
                    'created_at' => optional($p->created_at)->toIso8601String(),
                    'href' => '/admin/users/' . (int) $p->user_id,
                    'meta' => [
                        'status' => $p->status,
                        'user_id' => $p->user_id,
                        'old_phone' => $p->old_phone,
                        'new_phone' => $p->new_phone,
                    ],
                ]);
            }
        }

        if ($user->hasPermission('stock.manage')) {
            $moves = StockMovement::query()
                ->with(['product:id,name'])
                ->where('created_at', '>', $since)
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get(['id', 'product_id', 'quantity', 'direction', 'reason', 'admin_id', 'created_at']);

            $counts['stock_movements'] = StockMovement::query()->where('created_at', '>', $since)->count();

            foreach ($moves as $m) {
                $qty = (int) ($m->quantity ?? 0);
                $dir = (string) ($m->direction ?? '');
                $sign = $dir === 'in' ? '+' : ($dir === 'out' ? '-' : '');
                $productName = (string) ($m->product?->name ?? ('Produit #' . (int) $m->product_id));
                $addEvent([
                    'key' => 'stock_movement:' . $m->id,
                    'type' => 'stock_movement',
                    'id' => (int) $m->id,
                    'title' => 'Stock: ' . $sign . $qty . ' — ' . $productName,
                    'created_at' => optional($m->created_at)->toIso8601String(),
                    'href' => '/admin/stock',
                    'meta' => [
                        'product_id' => $m->product_id,
                        'direction' => $dir,
                        'quantity' => $qty,
                        'reason' => $m->reason,
                    ],
                ]);
            }
        }

        if ($user->hasPermission('redeems.view') || $user->hasPermission('redeems.manage') || $user->hasPermission('stock.manage')) {
            $alerts = RedeemStockAlert::query()
                ->with(['denomination:id,product_id,label,code', 'denomination.product:id,name'])
                ->whereNotNull('last_notified_at')
                ->where('last_notified_at', '>', $since)
                ->orderByDesc('last_notified_at')
                ->limit($limit)
                ->get(['id', 'denomination_id', 'last_notified_stock', 'last_notified_at', 'channel']);

            $counts['redeem_low_stock'] = RedeemStockAlert::query()
                ->whereNotNull('last_notified_at')
                ->where('last_notified_at', '>', $since)
                ->count();

            foreach ($alerts as $a) {
                $label = (string) ($a->denomination?->label ?? $a->denomination?->code ?? ('Denom #' . (int) $a->denomination_id));
                $product = (string) ($a->denomination?->product?->name ?? 'Redeem');
                $addEvent([
                    'key' => 'redeem_low_stock:' . $a->id,
                    'type' => 'redeem_low_stock',
                    'id' => (int) $a->id,
                    'title' => 'Low stock: ' . $product . ' — ' . $label,
                    'created_at' => optional($a->last_notified_at)->toIso8601String(),
                    'href' => '/admin/redeem-codes/low-stock',
                    'meta' => [
                        'denomination_id' => $a->denomination_id,
                        'last_notified_stock' => $a->last_notified_stock,
                        'channel' => $a->channel,
                    ],
                ]);
            }
        }

        usort($events, function ($a, $b) {
            return strcmp((string) ($b['created_at'] ?? ''), (string) ($a['created_at'] ?? ''));
        });

        $events = array_slice($events, 0, $limit);

        return [
            'counts' => $counts,
            'items' => $events,
        ];
    }
}
