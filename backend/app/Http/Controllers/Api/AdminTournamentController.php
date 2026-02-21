<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tournament;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminTournamentController extends Controller
{
    public function index(Request $request)
    {
        $query = Tournament::query()->with('game:id,name,slug');

        if ($q = trim((string) $request->query('q', ''))) {
            $query->where(function ($inner) use ($q) {
                $inner->where('name', 'like', "%{$q}%")
                    ->orWhere('slug', 'like', "%{$q}%")
                    ->orWhere('status', 'like', "%{$q}%");
            });
        }

        $items = $query->orderByDesc('created_at')->paginate((int) $request->integer('per_page', 30));

        return response()->json($items);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data = $this->normalizeData($data);

        $tournament = Tournament::create($data);

        return response()->json($tournament->load('game:id,name,slug'), 201);
    }

    public function update(Request $request, Tournament $tournament)
    {
        $data = $this->validated($request, $tournament->id, true);
        $data = $this->normalizeData($data, $tournament);

        $tournament->update($data);

        return response()->json($tournament->fresh()->load('game:id,name,slug'));
    }

    public function destroy(Tournament $tournament)
    {
        $tournament->delete();

        return response()->json(['message' => 'Tournament deleted']);
    }

    private function validated(Request $request, ?int $ignoreId = null, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'game_id' => ['nullable', 'integer', 'exists:games,id'],
            'name' => [$required, 'string', 'max:180'],
            'slug' => [
                'nullable',
                'string',
                'max:200',
                Rule::unique('tournaments', 'slug')->ignore($ignoreId),
            ],
            'status' => [$partial ? 'sometimes' : 'nullable', 'string', Rule::in(['upcoming', 'live', 'finished'])],
            'is_active' => ['nullable', 'boolean'],
            'is_free' => ['nullable', 'boolean'],
            'prize_pool_fcfa' => ['nullable', 'integer', 'min:0'],
            'entry_fee_fcfa' => ['nullable', 'integer', 'min:0'],
            'max_participants' => ['nullable', 'integer', 'min:1'],
            'registered_participants' => ['nullable', 'integer', 'min:0'],
            'format' => ['nullable', 'string', 'max:100'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date'],
            'registration_deadline' => ['nullable', 'date'],
            'description' => ['nullable', 'string'],
            'rules' => ['nullable', 'string'],
            'requirements' => ['nullable', 'string'],
            'stream_url' => ['nullable', 'string', 'max:255'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'image' => ['nullable', 'string', 'max:255'],
            'first_prize_fcfa' => ['nullable', 'integer', 'min:0'],
            'second_prize_fcfa' => ['nullable', 'integer', 'min:0'],
            'third_prize_fcfa' => ['nullable', 'integer', 'min:0'],
            'sponsors' => ['nullable', 'array'],
            'sponsors.*' => ['string', 'max:120'],
        ]);
    }

    private function normalizeData(array $data, ?Tournament $existing = null): array
    {
        if (!array_key_exists('slug', $data)) {
            if (array_key_exists('name', $data)) {
                $data['slug'] = Str::slug((string) $data['name']);
            }
        } elseif (empty($data['slug']) && array_key_exists('name', $data)) {
            $data['slug'] = Str::slug((string) $data['name']);
        }

        if ($existing && empty($data['slug'])) {
            unset($data['slug']);
        }

        $isFree = array_key_exists('is_free', $data)
            ? (bool) $data['is_free']
            : ($existing ? (bool) $existing->is_free : false);

        if ($isFree) {
            $data['entry_fee_fcfa'] = 0;
        }

        if (!array_key_exists('status', $data)) {
            $data['status'] = $existing?->status ?? 'upcoming';
        }

        return $data;
    }
}
