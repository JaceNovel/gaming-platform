<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Game;
use Illuminate\Http\Request;

class GameController extends Controller
{
    public function index(Request $request)
    {
        $query = Game::query();

        if ($request->boolean('active', true)) {
            $query->where('is_active', true);
        }

        if ($search = $request->input('q')) {
            $query->where('name', 'like', "%{$search}%");
        }

        $games = $query->orderBy('name')->paginate(20);

        return response()->json($games);
    }

    public function show(Game $game)
    {
        return response()->json($game);
    }
}
