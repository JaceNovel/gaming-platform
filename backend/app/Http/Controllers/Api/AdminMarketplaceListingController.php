<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\TemplatedNotification;
use App\Models\SellerListing;
use App\Services\AdminAuditLogger;
use App\Services\LoggedEmailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminMarketplaceListingController extends Controller
{
    private function frontendUrl(string $path = ''): string
    {
        $base = rtrim((string) (env('FRONTEND_URL', config('app.url'))), '/');
        $p = '/' . ltrim($path, '/');
        return $base . ($path !== '' ? $p : '');
    }

    public function index(Request $request)
    {
        $q = SellerListing::query()->with(['seller.user', 'game', 'category']);

        if ($request->filled('status')) {
            $q->where('status', $request->string('status')->toString());
        }

        if ($request->filled('seller_id')) {
            $q->where('seller_id', $request->integer('seller_id'));
        }

        if ($request->filled('game_id')) {
            $q->where('game_id', $request->integer('game_id'));
        }

        if ($request->filled('search')) {
            $search = '%' . $request->string('search')->toString() . '%';
            $q->where(function ($sub) use ($search) {
                $sub->where('title', 'like', $search)
                    ->orWhere('description', 'like', $search)
                    ->orWhereHas('seller.user', function ($uq) use ($search) {
                        $uq->where('email', 'like', $search)->orWhere('name', 'like', $search);
                    });
            });
        }

        $perPage = (int) $request->integer('per_page', 30);

        $listings = $q->orderByDesc('updated_at')->paginate($perPage);

        return response()->json(['data' => $listings]);
    }

    public function show(SellerListing $sellerListing)
    {
        $sellerListing->load(['seller.user', 'game', 'category']);

        return response()->json(['data' => $sellerListing]);
    }

    public function approve(Request $request, SellerListing $sellerListing)
    {
        $admin = $request->user();

        DB::transaction(function () use ($sellerListing, $admin) {
            $listing = SellerListing::query()->lockForUpdate()->findOrFail($sellerListing->id);
            $listing->loadMissing('seller');

            if ($listing->order_id || $listing->sold_at) {
                throw ValidationException::withMessages([
                    'status' => ['Cannot approve a sold listing.'],
                ]);
            }

            $seller = $listing->seller;
            if (!$seller || !$seller->isApproved() || $seller->partner_wallet_frozen) {
                throw ValidationException::withMessages([
                    'seller' => ['Seller is not eligible to publish listings.'],
                ]);
            }

            $listing->status = 'approved';
            $listing->status_reason = null;
            $listing->reviewed_at = now();
            $listing->reviewed_by = $admin->id;
            $listing->approved_at = now();
            $listing->rejected_at = null;
            $listing->suspended_at = null;
            $listing->save();
        });

        // Email seller (best-effort)
        try {
            $fresh = SellerListing::query()->with(['seller.user', 'game'])->find($sellerListing->id);
            $user = $fresh?->seller?->user;
            if ($fresh && $user && $user->email) {
                $subject = 'Annonce approuvée - PRIME Gaming';
                $mailable = new TemplatedNotification(
                    'marketplace_listing_approved',
                    $subject,
                    [
                        'listing' => $fresh->toArray(),
                        'seller' => $fresh->seller?->toArray() ?? [],
                        'user' => $user->toArray(),
                    ],
                    [
                        'title' => $subject,
                        'headline' => 'Annonce approuvée',
                        'intro' => 'Bonne nouvelle: ton annonce est maintenant publiée sur le marketplace.',
                        'details' => [
                            ['label' => 'Annonce', 'value' => (string) ($fresh->title ?? ('#' . $fresh->id))],
                            ['label' => 'Jeu', 'value' => (string) ($fresh->game?->name ?? '—')],
                            ['label' => 'Prix', 'value' => number_format((float) ($fresh->price ?? 0), 0, ',', ' ') . ' FCFA'],
                        ],
                        'actionUrl' => $this->frontendUrl('/account/seller'),
                        'actionText' => 'Voir mes annonces',
                        'outro' => 'Merci pour ta confiance.',
                    ]
                );

                /** @var LoggedEmailService $logged */
                $logged = app(LoggedEmailService::class);
                $logged->queue($user->id, $user->email, 'marketplace_listing_approved', $subject, $mailable, [
                    'seller_listing_id' => $fresh->id,
                ]);
            }
        } catch (\Throwable $e) {
        }

        try {
            /** @var AdminAuditLogger $audit */
            $audit = app(AdminAuditLogger::class);
            $audit->log($admin, 'marketplace.listing.approve', [
                'seller_listing_id' => $sellerListing->id,
            ], 'marketplace', $request);
        } catch (\Throwable $e) {
        }

        return response()->json(['ok' => true]);
    }

    public function reject(Request $request, SellerListing $sellerListing)
    {
        $admin = $request->user();

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($sellerListing, $admin, $data) {
            $listing = SellerListing::query()->lockForUpdate()->findOrFail($sellerListing->id);

            if ($listing->order_id || $listing->sold_at) {
                throw ValidationException::withMessages([
                    'status' => ['Cannot reject a sold listing.'],
                ]);
            }

            $listing->status = 'rejected';
            $listing->status_reason = $data['reason'];
            $listing->reviewed_at = now();
            $listing->reviewed_by = $admin->id;
            $listing->approved_at = null;
            $listing->rejected_at = now();
            $listing->suspended_at = null;
            $listing->reserved_order_id = null;
            $listing->reserved_until = null;
            $listing->save();
        });

        // Email seller (best-effort)
        try {
            $fresh = SellerListing::query()->with(['seller.user', 'game'])->find($sellerListing->id);
            $user = $fresh?->seller?->user;
            if ($fresh && $user && $user->email) {
                $subject = 'Annonce refusée - PRIME Gaming';
                $reason = (string) ($fresh->status_reason ?? $data['reason']);
                $mailable = new TemplatedNotification(
                    'marketplace_listing_rejected',
                    $subject,
                    [
                        'listing' => $fresh->toArray(),
                        'seller' => $fresh->seller?->toArray() ?? [],
                        'user' => $user->toArray(),
                        'reason' => $reason,
                    ],
                    [
                        'title' => $subject,
                        'headline' => 'Annonce refusée',
                        'intro' => 'Ton annonce a été refusée après vérification.',
                        'details' => [
                            ['label' => 'Annonce', 'value' => (string) ($fresh->title ?? ('#' . $fresh->id))],
                            ['label' => 'Raison', 'value' => $reason ?: '—'],
                        ],
                        'actionUrl' => $this->frontendUrl('/account/seller'),
                        'actionText' => 'Modifier et renvoyer',
                    ]
                );

                /** @var LoggedEmailService $logged */
                $logged = app(LoggedEmailService::class);
                $logged->queue($user->id, $user->email, 'marketplace_listing_rejected', $subject, $mailable, [
                    'seller_listing_id' => $fresh->id,
                ]);
            }
        } catch (\Throwable $e) {
        }

        try {
            /** @var AdminAuditLogger $audit */
            $audit = app(AdminAuditLogger::class);
            $audit->log($admin, 'marketplace.listing.reject', [
                'seller_listing_id' => $sellerListing->id,
                'reason' => $data['reason'],
            ], 'marketplace', $request);
        } catch (\Throwable $e) {
        }

        return response()->json(['ok' => true]);
    }

    public function suspend(Request $request, SellerListing $sellerListing)
    {
        $admin = $request->user();

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($sellerListing, $admin, $data) {
            $listing = SellerListing::query()->lockForUpdate()->findOrFail($sellerListing->id);

            if ($listing->order_id || $listing->sold_at) {
                throw ValidationException::withMessages([
                    'status' => ['Cannot suspend a sold listing.'],
                ]);
            }

            $listing->status = 'suspended';
            $listing->status_reason = $data['reason'];
            $listing->reviewed_at = now();
            $listing->reviewed_by = $admin->id;
            $listing->approved_at = null;
            $listing->rejected_at = null;
            $listing->suspended_at = now();
            $listing->reserved_order_id = null;
            $listing->reserved_until = null;
            $listing->save();
        });

        // Email seller (best-effort)
        try {
            $fresh = SellerListing::query()->with(['seller.user', 'game'])->find($sellerListing->id);
            $user = $fresh?->seller?->user;
            if ($fresh && $user && $user->email) {
                $subject = 'Annonce suspendue - PRIME Gaming';
                $reason = (string) ($fresh->status_reason ?? $data['reason']);
                $mailable = new TemplatedNotification(
                    'marketplace_listing_suspended',
                    $subject,
                    [
                        'listing' => $fresh->toArray(),
                        'seller' => $fresh->seller?->toArray() ?? [],
                        'user' => $user->toArray(),
                        'reason' => $reason,
                    ],
                    [
                        'title' => $subject,
                        'headline' => 'Annonce suspendue',
                        'intro' => 'Ton annonce a été suspendue.',
                        'details' => [
                            ['label' => 'Annonce', 'value' => (string) ($fresh->title ?? ('#' . $fresh->id))],
                            ['label' => 'Raison', 'value' => $reason ?: '—'],
                        ],
                        'actionUrl' => $this->frontendUrl('/account/seller'),
                        'actionText' => 'Voir mes annonces',
                    ]
                );

                /** @var LoggedEmailService $logged */
                $logged = app(LoggedEmailService::class);
                $logged->queue($user->id, $user->email, 'marketplace_listing_suspended', $subject, $mailable, [
                    'seller_listing_id' => $fresh->id,
                ]);
            }
        } catch (\Throwable $e) {
        }

        try {
            /** @var AdminAuditLogger $audit */
            $audit = app(AdminAuditLogger::class);
            $audit->log($admin, 'marketplace.listing.suspend', [
                'seller_listing_id' => $sellerListing->id,
                'reason' => $data['reason'],
            ], 'marketplace', $request);
        } catch (\Throwable $e) {
        }

        return response()->json(['ok' => true]);
    }
}
