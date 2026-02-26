<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tournament;
use Illuminate\Http\Request;

class TournamentController extends Controller
{
    public function index(Request $request)
    {
        $query = Tournament::query()->with('game:id,name,slug')->withCount('registrations');

        if ($request->boolean('active', true)) {
            $query->where('is_active', true);
        }

        if ($status = strtolower((string) $request->query('status', ''))) {
            if (in_array($status, ['upcoming', 'live', 'finished'], true)) {
                $query->where('status', $status);
            }
        }

        if ($search = trim((string) $request->query('q', ''))) {
            $query->where(function ($inner) use ($search) {
                $inner->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('format', 'like', "%{$search}%");
            });
        }

        $tournaments = $query
            ->orderByRaw("CASE status WHEN 'live' THEN 1 WHEN 'upcoming' THEN 2 ELSE 3 END")
            ->orderBy('starts_at')
            ->paginate((int) $request->integer('per_page', 12));

        $tournaments->setCollection(
            $tournaments->getCollection()->map(fn (Tournament $tournament) => $this->transformTournament($tournament))
        );

        return response()->json($tournaments);
    }

    public function show(string $slug)
    {
        $tournament = Tournament::query()
            ->with('game:id,name,slug')
            ->with(['rewards.user:id,name'])
            ->withCount('registrations')
            ->where('slug', $slug)
            ->where('is_active', true)
            ->firstOrFail();

        return response()->json($this->transformTournament($tournament));
    }

    public function ramadanWinners()
    {
        $tournament = Tournament::query()
            ->with(['rewards.user:id,name'])
            ->whereNotNull('rewards_published_at')
            ->whereNotNull('rewards_banner_expires_at')
            ->where('rewards_banner_expires_at', '>=', now())
            ->orderByDesc('rewards_published_at')
            ->first();

        if (!$tournament) {
            return response()->json([
                'active' => false,
                'message' => 'Aucun résultat Ramadan actif.',
            ]);
        }

        return response()->json([
            'active' => true,
            'tournament' => [
                'id' => $tournament->id,
                'name' => $tournament->name,
                'slug' => $tournament->slug,
            ],
            'expires_at' => $tournament->rewards_banner_expires_at,
            'winners' => $tournament->rewards
                ->sortBy('place')
                ->values()
                ->map(fn ($reward) => [
                    'place' => (int) $reward->place,
                    'name' => (string) ($reward->user?->name ?? 'Joueur'),
                    'reward_amount_fcfa' => (int) ($reward->reward_amount_fcfa ?? 0),
                ]),
        ]);
    }

    private function transformTournament(Tournament $tournament): Tournament
    {
        $realCount = (int) ($tournament->registrations_count ?? 0);
        $maxParticipants = max(1, (int) ($tournament->max_participants ?? 0));
        $simulatedBase = $this->simulatedCount($tournament->id);
        $displayedCount = min($maxParticipants, $simulatedBase + $realCount);

        $tournament->setAttribute('registered_participants', $displayedCount);
        $tournament->setAttribute('real_registered_participants', $realCount);
        $tournament->setAttribute('display_base_participants', $simulatedBase);

        return $tournament;
    }

    private function simulatedCount(int $seed): int
    {
        return 20 + (($seed * 7) % 21);
    }
}
