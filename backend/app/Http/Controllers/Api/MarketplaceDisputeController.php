<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Dispute;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MarketplaceDisputeController extends Controller
{
    public function mine(Request $request)
    {
        $user = $request->user();

        $disputes = Dispute::query()
            ->where('buyer_id', $user->id)
            ->with([
                'listing',
                'marketplaceOrder.order',
                'seller.user',
            ])
            ->orderByDesc('created_at')
            ->paginate(20);

        $disputes->getCollection()->transform(function (Dispute $d) {
            $evidence = is_array($d->evidence) ? $d->evidence : [];
            $d->setAttribute('evidence_urls', array_values(array_filter(array_map(function ($path) {
                if (!is_string($path) || !$path) return null;
                try {
                    $raw = trim((string) $path);
                    if ($raw === '') return null;
                    if (preg_match('/^https?:\/\//i', $raw)) return $raw;
                    if (str_starts_with($raw, '/api/storage/')) return $raw;
                    if (str_starts_with($raw, '/storage/')) return '/api' . $raw;
                    return '/api/storage/' . ltrim($raw, '/');
                } catch (\Throwable $e) {
                    return null;
                }
            }, $evidence))));
            return $d;
        });

        return response()->json(['data' => $disputes]);
    }
}
