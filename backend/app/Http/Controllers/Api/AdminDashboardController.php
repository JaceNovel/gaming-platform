<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\EmailLog;
use App\Models\Like;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Payout;
use App\Models\PremiumMembership;
use App\Models\Product;
use App\Models\RedeemDenomination;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminDashboardController extends Controller
{
    private function realUsers(): Builder
    {
        return User::query()->where('email', 'not like', 'likebot+%@badboyshop.local');
    }

    public function statsOverview(Request $request)
    {
        $revenueTotal = (float) Payment::where('status', 'completed')->sum('amount');
        $totalOrders = Order::count();
        $totalProducts = Product::count();
        $totalCustomers = $this->realUsers()->where('role', 'user')->count();
        $avgOrderValue = $totalOrders > 0 ? round($revenueTotal / $totalOrders, 2) : 0;
        $failedPaymentsCount = Payment::where('status', 'failed')->count();
        $pendingOrdersCount = Order::where('status', 'pending')->count();

        $availableRedeems = RedeemDenomination::withCount([
            'codes as available_count' => fn ($query) => $query->where('status', 'available'),
        ])
            ->orderBy('diamonds')
            ->get()
            ->mapWithKeys(fn ($denom) => [
                $denom->code => (int) $denom->available_count,
            ]);

        $conversionRate = null;
        $totalUsers = $this->realUsers()->count();
        if ($totalUsers > 0) {
            $paidUsers = Order::where('status', 'paid')
                ->whereIn('user_id', $this->realUsers()->select('id'))
                ->distinct('user_id')
                ->count('user_id');
            $conversionRate = round(($paidUsers / $totalUsers) * 100, 2);
        }

        return response()->json([
            'data' => [
                'revenue_total' => $revenueTotal,
                'total_orders' => $totalOrders,
                'total_products' => $totalProducts,
                'total_customers' => $totalCustomers,
                'conversion_rate' => $conversionRate,
                'avg_order_value' => $avgOrderValue,
                'failed_payments_count' => $failedPaymentsCount,
                'pending_orders_count' => $pendingOrdersCount,
                'available_redeems_by_category' => $availableRedeems,
            ],
        ]);
    }

    public function revenue(Request $request)
    {
        $range = $request->query('range', 'month');

        [$start, $end, $groupBy, $format] = match ($range) {
            'week' => [Carbon::today()->subDays(6), Carbon::today(), 'day', 'd M'],
            'year' => [Carbon::today()->subMonths(11)->startOfMonth(), Carbon::today()->endOfMonth(), 'month', 'M Y'],
            default => [Carbon::today()->subDays(29), Carbon::today(), 'day', 'd M'],
        };

        $labels = [];
        $cursor = $start->copy();
        while ($cursor <= $end) {
            $labels[] = $cursor->format($format);
            $cursor = $groupBy === 'month' ? $cursor->addMonth() : $cursor->addDay();
        }

        $groupExpr = $groupBy === 'month' ? "date_trunc('month', created_at)" : "date_trunc('day', created_at)";

        $rows = Payment::query()
            ->selectRaw("{$groupExpr} as bucket, SUM(amount) as total")
            ->where('status', 'paid')
            ->whereBetween('created_at', [$start->startOfDay(), $end->endOfDay()])
            ->groupBy('bucket')
            ->orderBy('bucket')
            ->get();

        $lookup = $rows->mapWithKeys(function ($row) use ($groupBy, $format) {
            $bucket = Carbon::parse($row->bucket)->format($format);
            return [$bucket => (float) $row->total];
        });

        $values = array_map(fn ($label) => $lookup[$label] ?? 0, $labels);

        return response()->json([
            'data' => [
                'labels' => $labels,
                'values' => $values,
            ],
        ]);
    }
    public function overview(Request $request)
    {
        $user = $request->user();

        $totals = [
            'orders' => Order::count(),
            'paid_payments' => Payment::where('status', 'completed')->count(),
            'users' => $this->realUsers()->count(),
            'active_premium' => PremiumMembership::where('is_active', true)
                ->whereDate('expiration_date', '>=', Carbon::today())
                ->count(),
        ];

        return response()->json([
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'role' => $user->role,
            ],
            'totals' => $totals,
        ]);
    }

    public function summary(Request $request)
    {
        if (!$this->isSuperAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        [$from, $to] = $this->parseDateRange($request);

        $payments = Payment::where('status', 'completed');
        $payments = $this->applyDateRange($payments, $from, $to);

        $brut = (clone $payments)->sum('amount');
        $net = round($brut * 0.15, 2);
        $funds = round($brut * 0.85, 2);

        $salesToday = Payment::where('status', 'completed')
            ->whereDate('created_at', Carbon::today())
            ->count();

        $premiumCounts = PremiumMembership::where('is_active', true)
            ->whereDate('expiration_date', '>=', Carbon::today())
            ->selectRaw('level, COUNT(*) as total')
            ->groupBy('level')
            ->pluck('total', 'level');

        $premiumUsers = $this->realUsers()->where('is_premium', true)->count();
        $totalUsers = $this->realUsers()->count();
        $conversion = $totalUsers > 0 ? round(($premiumUsers / $totalUsers) * 100, 2) : 0;

        return response()->json([
            'brut' => (float) $brut,
            'net' => (float) $net,
            'funds' => (float) $funds,
            'sales_today' => $salesToday,
            'premium' => [
                'bronze' => (int) ($premiumCounts['bronze'] ?? 0),
                'or' => (int) ($premiumCounts['or'] ?? 0),
                'platine' => (int) ($premiumCounts['platine'] ?? 0),
                'conversion_rate' => $conversion,
            ],
        ]);
    }

    public function charts(Request $request)
    {
        if (!$this->isSuperAdmin($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        [$from, $to] = $this->parseDateRange($request);

        $payments = Payment::where('status', 'completed');
        $payments = $this->applyDateRange($payments, $from, $to);

        $daily = $this->groupPaymentsBy($payments, 'day');
        $monthly = $this->groupPaymentsBy($payments, 'month');
        $byType = $this->sumByProductAttribute($from, $to, 'type');
        $byGame = $this->sumByGame($from, $to);
        $byCountry = $this->sumByCountry($from, $to);

        return response()->json([
            'daily' => $daily,
            'monthly' => $monthly,
            'by_type' => $byType,
            'by_game' => $byGame,
            'by_country' => $byCountry,
        ]);
    }

    public function tables(Request $request)
    {
        [$from, $to] = $this->parseDateRange($request);
        $perPage = $request->integer('per_page', 10);
        $role = $this->role($request);

        $empty = $this->emptyPaginator($perPage);

        $orders = $empty;
        $payments = $empty;
        $users = $empty;
        $premiumMemberships = $empty;
        $products = $empty;
        $likes = $empty;
        $chat = $empty;
        $payouts = $empty;
        $emails = $empty;

        if ($this->isSuperAdmin($request)) {
            $orders = Order::with(['user', 'payment'])
                ->latest()
                ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
                ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to))
                ->paginate($perPage);

            $payments = Payment::with(['order.user'])
                ->where('status', 'completed')
                ->latest()
                ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
                ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to))
                ->paginate($perPage);

            $users = User::withCount('orders')
                ->latest()
                ->paginate($perPage);

            $premiumMemberships = PremiumMembership::with(['user', 'game'])
                ->latest()
                ->paginate($perPage);

            $products = Product::with('game')
                ->withCount('likes')
                ->latest()
                ->paginate($perPage);

            $likes = Like::with(['user', 'product'])
                ->latest()
                ->paginate($perPage);

            $chat = ChatMessage::with(['user', 'room'])
                ->latest()
                ->paginate($perPage);

            $payouts = Payout::with('user')
                ->latest()
                ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
                ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to))
                ->paginate($perPage);

            $emails = EmailLog::with('user')
                ->latest()
                ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
                ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to))
                ->paginate($perPage);
        } elseif ($role === 'admin_article') {
            $products = Product::with('game')
                ->withCount('likes')
                ->latest()
                ->paginate($perPage);
        } elseif ($role === 'admin_client') {
            $orders = Order::with(['user', 'payment'])
                ->latest()
                ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
                ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to))
                ->paginate($perPage);

            $payments = Payment::with(['order.user'])
                ->where('status', 'completed')
                ->latest()
                ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
                ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to))
                ->paginate($perPage);

            $users = User::withCount('orders')
                ->latest()
                ->paginate($perPage);

            $emails = EmailLog::with('user')
                ->latest()
                ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
                ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to))
                ->paginate($perPage);
        }

        return response()->json([
            'orders' => $orders,
            'payments' => $payments,
            'users' => $users,
            'premium_memberships' => $premiumMemberships,
            'products' => $products,
            'likes' => $likes,
            'chat_messages' => $chat,
            'payouts' => $payouts,
            'email_logs' => $emails,
        ]);
    }

    public function export(Request $request)
    {
        [$from, $to] = $this->parseDateRange($request);
        $type = $request->input('type');
        $allowed = $this->allowedExportTypes($request);

        if (!in_array($type, $allowed, true)) {
            return response()->json(['message' => 'Invalid export type'], 422);
        }

        [$headers, $rows] = match ($type) {
            'orders' => $this->exportOrders($from, $to),
            'payments' => $this->exportPayments($from, $to),
            'users' => $this->exportUsers(),
            'premium_memberships' => $this->exportPremiums($from, $to),
            'products' => $this->exportProducts(),
            'likes' => $this->exportLikes($from, $to),
            'chat_messages' => $this->exportChat($from, $to),
            'payouts' => $this->exportPayouts($from, $to),
            'email_logs' => $this->exportEmailLogs($from, $to),
            default => [[], []],
        };

        $filename = $type . '-export-' . Carbon::now()->format('Ymd_His') . '.csv';

        return new StreamedResponse(function () use ($headers, $rows) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, $headers);
            foreach ($rows as $row) {
                fputcsv($handle, $row);
            }
            fclose($handle);
        }, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    private function parseDateRange(Request $request): array
    {
        $from = $request->filled('from') ? Carbon::parse($request->input('from'))->startOfDay() : null;
        $to = $request->filled('to') ? Carbon::parse($request->input('to'))->endOfDay() : null;

        return [$from, $to];
    }

    private function applyDateRange(Builder|QueryBuilder $query, ?Carbon $from, ?Carbon $to, string $column = 'created_at')
    {
        return $query
            ->when($from, fn ($q) => $q->whereDate($column, '>=', $from))
            ->when($to, fn ($q) => $q->whereDate($column, '<=', $to));
    }

    private function groupPaymentsBy(Builder|QueryBuilder $payments, string $granularity)
    {
        $clone = clone $payments;
        $format = $granularity === 'month' ? '%Y-%m' : '%Y-%m-%d';

        return $clone
            ->selectRaw("DATE_FORMAT(created_at, '{$format}') as label, SUM(amount) as brut")
            ->groupBy('label')
            ->orderBy('label')
            ->get()
            ->map(function ($row) {
                $brut = (float) $row->brut;
                return [
                    'label' => $row->label,
                    'brut' => $brut,
                    'net' => round($brut * 0.15, 2),
                    'funds' => round($brut * 0.85, 2),
                ];
            });
    }

    private function sumByProductAttribute(?Carbon $from, ?Carbon $to, string $attribute)
    {
        $query = Payment::where('payments.status', 'completed')
            ->join('orders', 'orders.id', '=', 'payments.order_id')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->join('products', 'products.id', '=', 'order_items.product_id');

        $query = $this->applyDateRange($query, $from, $to, 'payments.created_at');

        return $query
            ->selectRaw("products.{$attribute} as label, SUM(order_items.price * order_items.quantity) as brut")
            ->groupBy("products.{$attribute}")
            ->orderByDesc('brut')
            ->get()
            ->map(function ($row) {
                $brut = (float) $row->brut;
                return [
                    'label' => $row->label ?? 'unknown',
                    'brut' => $brut,
                    'net' => round($brut * 0.15, 2),
                ];
            });
    }

    private function sumByGame(?Carbon $from, ?Carbon $to)
    {
        $query = Payment::where('payments.status', 'completed')
            ->join('orders', 'orders.id', '=', 'payments.order_id')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->join('games', 'games.id', '=', 'products.game_id');

        $query = $this->applyDateRange($query, $from, $to, 'payments.created_at');

        return $query
            ->selectRaw('games.name as label, SUM(order_items.price * order_items.quantity) as brut')
            ->groupBy('games.name')
            ->orderByDesc('brut')
            ->get()
            ->map(function ($row) {
                $brut = (float) $row->brut;
                return [
                    'label' => $row->label,
                    'brut' => $brut,
                    'net' => round($brut * 0.15, 2),
                ];
            });
    }

    private function sumByCountry(?Carbon $from, ?Carbon $to)
    {
        $query = Payment::where('status', 'completed');
        $query = $this->applyDateRange($query, $from, $to);

        return $query
            ->selectRaw("COALESCE(JSON_UNQUOTE(JSON_EXTRACT(webhook_data, '$.country')), 'unknown') as label, SUM(amount) as brut")
            ->groupBy('label')
            ->orderByDesc('brut')
            ->get()
            ->map(function ($row) {
                $brut = (float) $row->brut;
                return [
                    'label' => $row->label,
                    'brut' => $brut,
                    'net' => round($brut * 0.15, 2),
                ];
            });
    }

    private function exportOrders(?Carbon $from, ?Carbon $to): array
    {
        $orders = Order::with(['user', 'payment'])
            ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to))
            ->get();

        $headers = ['id', 'user', 'status', 'total_price', 'payment_status', 'created_at'];
        $rows = $orders->map(function (Order $order) {
            return [
                $order->id,
                optional($order->user)->email,
                $order->status,
                $order->total_price,
                optional($order->payment)->status,
                optional($order->created_at)?->toDateTimeString(),
            ];
        })->toArray();

        return [$headers, $rows];
    }

    private function exportPayments(?Carbon $from, ?Carbon $to): array
    {
        $payments = Payment::with('order.user')
            ->where('status', 'completed')
            ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to))
            ->get();

        $headers = ['id', 'order_id', 'user', 'amount', 'status', 'created_at'];
        $rows = $payments->map(function (Payment $payment) {
            return [
                $payment->id,
                $payment->order_id,
                optional(optional($payment->order)->user)->email,
                $payment->amount,
                $payment->status,
                optional($payment->created_at)?->toDateTimeString(),
            ];
        })->toArray();

        return [$headers, $rows];
    }

    private function exportUsers(): array
    {
        $users = User::withCount(['orders', 'likes'])
            ->where('email', 'not like', 'likebot+%@badboyshop.local')
            ->get();
        $headers = ['id', 'name', 'email', 'is_premium', 'premium_level', 'orders_count', 'likes_count', 'created_at'];

        $rows = $users->map(function (User $user) {
            return [
                $user->id,
                $user->name,
                $user->email,
                $user->is_premium ? 'yes' : 'no',
                $user->premium_level,
                $user->orders_count,
                $user->likes_count,
                optional($user->created_at)?->toDateTimeString(),
            ];
        })->toArray();

        return [$headers, $rows];
    }

    private function exportPremiums(?Carbon $from, ?Carbon $to): array
    {
        $memberships = PremiumMembership::with(['user', 'game'])
            ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to))
            ->get();

        $headers = ['id', 'user', 'game', 'level', 'expiration_date', 'is_active', 'created_at'];
        $rows = $memberships->map(function (PremiumMembership $membership) {
            return [
                $membership->id,
                optional($membership->user)->email,
                optional($membership->game)->name,
                $membership->level,
                optional($membership->expiration_date)?->toDateString(),
                $membership->is_active ? 'yes' : 'no',
                optional($membership->created_at)?->toDateTimeString(),
            ];
        })->toArray();

        return [$headers, $rows];
    }

    private function exportProducts(): array
    {
        $products = Product::with(['game'])->withCount('likes')->get();
        $headers = ['id', 'name', 'game', 'type', 'price', 'stock', 'is_active', 'likes', 'created_at'];

        $rows = $products->map(function (Product $product) {
            return [
                $product->id,
                $product->name,
                optional($product->game)->name,
                $product->type,
                $product->price,
                $product->stock,
                $product->is_active ? 'yes' : 'no',
                $product->likes_count,
                optional($product->created_at)?->toDateTimeString(),
            ];
        })->toArray();

        return [$headers, $rows];
    }

    private function exportLikes(?Carbon $from, ?Carbon $to): array
    {
        $likes = Like::with(['user', 'product'])
            ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to))
            ->get();

        $headers = ['id', 'user', 'product', 'created_at'];
        $rows = $likes->map(function (Like $like) {
            return [
                $like->id,
                optional($like->user)->email,
                optional($like->product)->name,
                optional($like->created_at)?->toDateTimeString(),
            ];
        })->toArray();

        return [$headers, $rows];
    }

    private function exportChat(?Carbon $from, ?Carbon $to): array
    {
        $messages = ChatMessage::with(['user', 'room'])
            ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to))
            ->get();

        $headers = ['id', 'room', 'user', 'message', 'is_deleted', 'created_at'];
        $rows = $messages->map(function (ChatMessage $message) {
            return [
                $message->id,
                optional($message->room)->name,
                optional($message->user)->email,
                $message->message,
                $message->is_deleted ? 'yes' : 'no',
                optional($message->created_at)?->toDateTimeString(),
            ];
        })->toArray();

        return [$headers, $rows];
    }

    private function exportPayouts(?Carbon $from, ?Carbon $to): array
    {
        $payouts = Payout::with('user')
            ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to))
            ->get();

        $headers = ['id', 'user', 'amount', 'currency', 'status', 'provider', 'provider_ref', 'created_at'];
        $rows = $payouts->map(function (Payout $payout) {
            return [
                $payout->id,
                optional($payout->user)->email,
                $payout->amount,
                $payout->currency,
                $payout->status,
                $payout->provider,
                $payout->provider_ref,
                optional($payout->created_at)?->toDateTimeString(),
            ];
        })->toArray();

        return [$headers, $rows];
    }

    private function exportEmailLogs(?Carbon $from, ?Carbon $to): array
    {
        $emails = EmailLog::with('user')
            ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to))
            ->get();

        $headers = ['id', 'user', 'to', 'type', 'subject', 'status', 'error', 'sent_at', 'created_at'];
        $rows = $emails->map(function (EmailLog $log) {
            return [
                $log->id,
                optional($log->user)->email,
                $log->to,
                $log->type,
                $log->subject,
                $log->status,
                $log->error,
                optional($log->sent_at)?->toDateTimeString(),
                optional($log->created_at)?->toDateTimeString(),
            ];
        })->toArray();

        return [$headers, $rows];
    }

    private function role(Request $request): string
    {
        return $request->user()?->role ?? 'user';
    }

    private function isSuperAdmin(Request $request): bool
    {
        return in_array($this->role($request), ['admin', 'admin_super'], true);
    }

    private function emptyPaginator(int $perPage): LengthAwarePaginator
    {
        return new LengthAwarePaginator([], 0, $perPage);
    }

    private function allowedExportTypes(Request $request): array
    {
        $role = $this->role($request);

        if (in_array($role, ['admin', 'admin_super'], true)) {
            return [
                'orders',
                'payments',
                'users',
                'premium_memberships',
                'products',
                'likes',
                'chat_messages',
                'payouts',
                'email_logs',
            ];
        }

        if ($role === 'admin_article') {
            return ['products'];
        }

        if ($role === 'admin_client') {
            return ['orders', 'payments', 'users', 'email_logs'];
        }

        return [];
    }
}
