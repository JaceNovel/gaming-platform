<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tournament;
use Illuminate\Http\Request;

class TournamentController extends Controller
{
    public function index(Request $request)
    {
        $query = Tournament::query()->withCount('participants');

        if ($request->boolean('active', true)) {
            $query->where('is_active', true);
        }

        if ($search = $request->input('q')) {
            $query->where('name', 'like', "%{$search}%");
        }

        $tournaments = $query->orderByDesc('created_at')->paginate(20);

        return response()->json($tournaments);
    }

    public function show(Tournament $tournament)
    {
        $tournament->loadCount('participants');
        return response()->json($tournament);
    }
}
