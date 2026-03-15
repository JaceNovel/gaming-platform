<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PremiumRequest;
use App\Services\PremiumPartnershipService;
use Illuminate\Http\Request;

class AdminPremiumRequestController extends Controller
{
    public function __construct(private PremiumPartnershipService $premiumPartnerships)
    {
    }

    public function index(Request $request)
    {
        $query = PremiumRequest::query()->with(['user:id,name,email,phone', 'processor:id,name,email']);

        $status = trim((string) $request->query('status', ''));
        if ($status !== '' && $status !== 'all') {
            $query->where('status', $status);
        }

        $level = trim((string) $request->query('level', ''));
        if ($level !== '' && $level !== 'all') {
            $query->where('level', $level);
        }

        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $query->whereHas('user', function ($builder) use ($search) {
                $builder->where('name', 'like', '%' . $search . '%')
                    ->orWhere('email', 'like', '%' . $search . '%')
                    ->orWhere('phone', 'like', '%' . $search . '%');
            });
        }

        $requests = $query->latest()->paginate(max(1, min(100, (int) $request->query('per_page', 30))));
        $plans = $this->premiumPartnerships->planCatalog();

        $requests->getCollection()->transform(function (PremiumRequest $row) use ($plans) {
            $serialized = $this->premiumPartnerships->serializeForApi($row);

            return array_merge($serialized ?? [], [
                'plan' => $plans[(string) $row->level] ?? null,
                'user' => [
                    'id' => $row->user?->id,
                    'name' => $row->user?->name,
                    'email' => $row->user?->email,
                    'phone' => $row->user?->phone,
                ],
                'processor' => [
                    'id' => $row->processor?->id,
                    'name' => $row->processor?->name,
                    'email' => $row->processor?->email,
                ],
            ]);
        });

        return response()->json([
            'data' => $requests,
            'plans' => $plans,
        ]);
    }

    public function approve(Request $request, PremiumRequest $premiumRequest)
    {
        $data = $request->validate([
            'admin_note' => ['nullable', 'string', 'max:2000'],
        ]);

        $updated = $this->premiumPartnerships->approve($premiumRequest, $request->user(), $data['admin_note'] ?? null);

        return response()->json([
            'ok' => true,
            'request' => $this->premiumPartnerships->serializeForApi($updated),
        ]);
    }

    public function refuse(Request $request, PremiumRequest $premiumRequest)
    {
        $data = $request->validate([
            'admin_note' => ['nullable', 'string', 'max:2000'],
            'rejection_reasons' => ['required', 'string', 'max:5000'],
            'send_email' => ['nullable', 'boolean'],
        ]);

        $updated = $this->premiumPartnerships->refuse($premiumRequest, $request->user(), $data);

        return response()->json([
            'ok' => true,
            'request' => $this->premiumPartnerships->serializeForApi($updated),
        ]);
    }
}