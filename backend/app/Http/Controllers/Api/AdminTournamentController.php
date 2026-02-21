<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\TemplatedNotification;
use App\Models\Tournament;
use App\Models\TournamentRegistration;
use App\Services\LoggedEmailService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminTournamentController extends Controller
{
    private function frontendUrl(string $path = ''): string
    {
        $base = rtrim((string) (env('FRONTEND_URL', config('app.url'))), '/');
        $p = '/' . ltrim($path, '/');
        return $base . ($path !== '' ? $p : '');
    }

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

    public function show(Tournament $tournament)
    {
        return response()->json($tournament->load('game:id,name,slug'));
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
        $beforePlanningConfigured = (bool) ($tournament->planning_enabled)
            && !empty($tournament->first_match_at)
            && trim((string) ($tournament->reward_rules ?? '')) !== '';

        $data = $this->validated($request, $tournament->id, true);
        $data = $this->normalizeData($data, $tournament);

        $tournament->update($data);

        $tournament->refresh();
        $afterPlanningConfigured = (bool) ($tournament->planning_enabled)
            && !empty($tournament->first_match_at)
            && trim((string) ($tournament->reward_rules ?? '')) !== '';

        $planningFieldsTouched = array_key_exists('planning_enabled', $data)
            || array_key_exists('first_match_at', $data)
            || array_key_exists('reward_rules', $data)
            || array_key_exists('planning_notes', $data);

        if ($afterPlanningConfigured && (!$beforePlanningConfigured || $planningFieldsTouched)) {
            $this->sendPlanningEmails($tournament);
        }

        return response()->json($tournament->load('game:id,name,slug'));
    }

    public function destroy(Tournament $tournament)
    {
        $tournament->delete();

        return response()->json(['message' => 'Tournament deleted']);
    }

    public function registrations(Request $request, Tournament $tournament)
    {
        $perPage = max(1, min(100, (int) $request->integer('per_page', 30)));

        $items = $tournament->registrations()
            ->with(['user:id,name,email'])
            ->latest()
            ->paginate($perPage);

        $items->setCollection(
            $items->getCollection()->map(function ($registration) {
                return [
                    'id' => $registration->id,
                    'user_id' => $registration->user_id,
                    'user_name' => $registration->user?->name,
                    'user_email' => $registration->user?->email,
                    'game_player_id' => $registration->game_player_id,
                    'created_at' => $registration->created_at,
                ];
            })
        );

        return response()->json([
            'tournament' => [
                'id' => $tournament->id,
                'name' => $tournament->name,
                'slug' => $tournament->slug,
            ],
            'registrations' => $items,
            'total_registrations' => $tournament->registrations()->count(),
        ]);
    }

    public function exportRegistrations(Tournament $tournament): StreamedResponse
    {
        $filename = 'tournament_' . $tournament->id . '_players_' . now()->format('Ymd_His') . '.csv';

        return response()->streamDownload(function () use ($tournament) {
            $out = fopen('php://output', 'w');

            fputcsv($out, ['registration_id', 'user_id', 'user_name', 'user_email', 'game_player_id', 'registered_at']);

            $tournament->registrations()
                ->with(['user:id,name,email'])
                ->orderByDesc('id')
                ->chunk(500, function ($rows) use ($out) {
                    foreach ($rows as $row) {
                        fputcsv($out, [
                            $row->id,
                            $row->user_id,
                            $row->user?->name,
                            $row->user?->email,
                            $row->game_player_id,
                            optional($row->created_at)?->toDateTimeString(),
                        ]);
                    }
                });

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
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
            'first_match_at' => ['nullable', 'date'],
            'description' => ['nullable', 'string'],
            'rules' => ['nullable', 'string'],
            'requirements' => ['nullable', 'string'],
            'reward_rules' => ['nullable', 'string'],
            'planning_notes' => ['nullable', 'string'],
            'planning_enabled' => ['nullable', 'boolean'],
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

    private function sendPlanningEmails(Tournament $tournament): void
    {
        $registrations = TournamentRegistration::query()
            ->with('user:id,name,email')
            ->where('tournament_id', $tournament->id)
            ->get();

        /** @var LoggedEmailService $logged */
        $logged = app(LoggedEmailService::class);

        $subject = 'Planning du tournoi disponible - ' . $tournament->name;
        $planningUrl = $this->frontendUrl('/tournois/' . $tournament->slug . '/planning');

        foreach ($registrations as $registration) {
            $user = $registration->user;
            if (!$user || empty($user->email)) {
                continue;
            }

            $mailable = new TemplatedNotification(
                'tournament_planning_ready',
                $subject,
                [
                    'tournament' => $tournament->toArray(),
                    'registration' => $registration->toArray(),
                    'user' => $user->toArray(),
                    'planning_url' => $planningUrl,
                ],
                [
                    'title' => $subject,
                    'headline' => 'Le planning est prêt',
                    'intro' => 'Le planning de votre tournoi est désormais disponible.',
                    'details' => [
                        ['label' => 'Tournoi', 'value' => (string) $tournament->name],
                        ['label' => '1er match', 'value' => optional($tournament->first_match_at)?->format('d/m/Y H:i') ?? 'À venir'],
                        ['label' => 'ID de jeu', 'value' => (string) ($registration->game_player_id ?? '—')],
                    ],
                    'actionUrl' => $planningUrl,
                    'actionText' => 'Voir planning',
                ]
            );

            $logged->queue(
                $user->id,
                (string) $user->email,
                'tournament_planning_ready',
                $subject,
                $mailable,
                [
                    'tournament_id' => $tournament->id,
                    'registration_id' => $registration->id,
                ]
            );
        }
    }
}
