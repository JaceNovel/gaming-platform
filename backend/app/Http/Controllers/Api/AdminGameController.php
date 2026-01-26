<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Game;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AdminGameController extends Controller
{
    public function index(Request $request)
    {
        $query = Game::query();

        if ($request->filled('q')) {
            $search = $request->query('q');
            $query->where('name', 'like', "%{$search}%")
                ->orWhere('category', 'like', "%{$search}%");
        }

        $games = $query->orderBy('name')->get();

        return response()->json(['data' => $games]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'slug' => 'nullable|string|max:150|unique:games,slug',
            'description' => 'nullable|string',
            'image' => 'nullable|string|max:255',
            'category' => 'required|string|max:120',
            'is_active' => 'nullable|boolean',
        ]);

        $data['slug'] = $data['slug'] ?? Str::slug($data['name']);

        $game = Game::create($data);

        return response()->json($game, 201);
    }

    public function update(Request $request, Game $game)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:120',
            'slug' => 'sometimes|string|max:150|unique:games,slug,' . $game->id,
            'description' => 'nullable|string',
            'image' => 'nullable|string|max:255',
            'category' => 'sometimes|string|max:120',
            'is_active' => 'nullable|boolean',
        ]);

        if (array_key_exists('name', $data) && !array_key_exists('slug', $data)) {
            $data['slug'] = Str::slug($data['name']);
        }

        $game->update($data);

        return response()->json($game);
    }

    public function destroy(Game $game)
    {
        $game->delete();

        return response()->json(['message' => 'Game deleted']);
    }
}
