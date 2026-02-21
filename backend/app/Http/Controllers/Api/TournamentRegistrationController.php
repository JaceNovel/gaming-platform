<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tournament;
use App\Models\TournamentRegistration;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TournamentRegistrationController extends Controller
{
    public function store(Request $request, Tournament $tournament)
    {
        $user = $request->user();

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

        DB::transaction(function () use ($tournament, $user) {
            TournamentRegistration::create([
                'tournament_id' => $tournament->id,
                'user_id' => $user->id,
            ]);

            $tournament->increment('registered_participants');
        });

        $updatedReal = TournamentRegistration::query()->where('tournament_id', $tournament->id)->count();

        return response()->json([
            'message' => 'Inscription confirmée.',
            'tournament_id' => $tournament->id,
            'registered_participants' => $updatedReal,
        ], 201);
    }
}
