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

        $context = strtolower((string) $request->query('context', ''));
        if ($context === 'recharge') {
            $query->where('enabled_for_recharge', true);
        } elseif ($context === 'subscription') {
            $query->where('enabled_for_subscription', true);
        } elseif ($context === 'marketplace') {
            $query->where('enabled_for_marketplace', true);
        }

        if ($search = $request->input('q')) {
            $query->where('name', 'like', "%{$search}%");
        }

        $games = $query->orderBy('sort_order')->orderBy('name')->paginate((int) $request->integer('per_page', 20));

        return response()->json($games);
    }

    public function show(Game $game)
    {
        return response()->json($game);
    }
}
