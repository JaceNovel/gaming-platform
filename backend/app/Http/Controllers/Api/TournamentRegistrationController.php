<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tournament;
use App\Models\TournamentRegistration;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TournamentRegistrationController extends Controller
{
    public function mine(Request $request)
    {
        $user = $request->user();

        $rows = TournamentRegistration::query()
            ->with(['tournament:id,name,slug,planning_enabled,first_match_at,reward_rules,planning_notes'])
            ->where('user_id', $user->id)
            ->latest()
            ->get()
            ->map(function (TournamentRegistration $row) {
                return [
                    'id' => $row->id,
                    'tournament_id' => $row->tournament_id,
                    'tournament_name' => $row->tournament?->name,
                    'tournament_slug' => $row->tournament?->slug,
                    'planning_enabled' => (bool) ($row->tournament?->planning_enabled ?? false),
                    'first_match_at' => $row->tournament?->first_match_at,
                    'reward_rules' => $row->tournament?->reward_rules,
                    'planning_notes' => $row->tournament?->planning_notes,
                    'game_player_id' => $row->game_player_id,
                    'registered_at' => $row->created_at,
                ];
            });

        return response()->json([
            'count' => $rows->count(),
            'data' => $rows,
        ]);
    }

    public function store(Request $request, Tournament $tournament)
    {
        $user = $request->user();
        $payload = $request->validate([
            'game_player_id' => ['required', 'string', 'min:2', 'max:120'],
        ]);

        if (!$tournament->is_active) {
            return response()->json(['message' => 'Ce tournoi est indisponible.'], 422);
        }

        $already = TournamentRegistration::query()
            ->where('tournament_id', $tournament->id)
            ->where('user_id', $user->id)
            ->exists();

        if ($already) {
            return response()->json(['message' => 'Vous êtes déjà inscrit à ce tournoi.'], 409);
        }

        $maxParticipants = (int) ($tournament->max_participants ?? 0);
        $realCount = TournamentRegistration::query()->where('tournament_id', $tournament->id)->count();
        if ($maxParticipants > 0 && $realCount >= $maxParticipants) {
            return response()->json(['message' => 'Le tournoi est complet.'], 422);
        }

        DB::transaction(function () use ($tournament, $user, $payload) {
            TournamentRegistration::create([
                'tournament_id' => $tournament->id,
                'user_id' => $user->id,
                'game_player_id' => $payload['game_player_id'],
            ]);

            $tournament->increment('registered_participants');
        });

        $updatedReal = TournamentRegistration::query()->where('tournament_id', $tournament->id)->count();

        return response()->json([
            'message' => 'Inscription confirmée.',
            'tournament_id' => $tournament->id,
            'registered_participants' => $updatedReal,
            'game_player_id' => $payload['game_player_id'],
        ], 201);
    }
}
