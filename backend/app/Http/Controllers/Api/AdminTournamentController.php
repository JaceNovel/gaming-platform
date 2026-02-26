<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\TemplatedNotification;
use App\Models\Tournament;
use App\Models\TournamentRegistration;
use App\Models\TournamentReward;
use App\Models\WalletAccount;
use App\Models\WalletTransaction;
use App\Services\LoggedEmailService;
use Illuminate\Support\Facades\DB;
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

    public function publishRewards(Request $request, Tournament $tournament)
    {
        $payload = $request->validate([
            'first_user_id' => ['required', 'integer', 'distinct'],
            'second_user_id' => ['required', 'integer', 'different:first_user_id', 'distinct'],
            'third_user_id' => ['required', 'integer', 'different:first_user_id', 'different:second_user_id', 'distinct'],
        ]);

        $registrationUserIds = TournamentRegistration::query()
            ->where('tournament_id', $tournament->id)
            ->pluck('user_id')
            ->map(fn ($value) => (int) $value)
            ->all();

        $registered = array_flip($registrationUserIds);
        $places = [
            1 => (int) $payload['first_user_id'],
            2 => (int) $payload['second_user_id'],
            3 => (int) $payload['third_user_id'],
        ];

        foreach ($places as $place => $userId) {
            if (!isset($registered[$userId])) {
                return response()->json([
                    'message' => "Le gagnant place {$place} doit être inscrit au tournoi.",
                ], 422);
            }
        }

        $rewardByPlace = [
            1 => 9500,
            2 => 8000,
            3 => 1500,
        ];

        DB::transaction(function () use ($tournament, $places, $rewardByPlace) {
            TournamentReward::query()->where('tournament_id', $tournament->id)->delete();

            foreach ($places as $place => $userId) {
                $amount = (int) ($rewardByPlace[$place] ?? 0);
                $minPurchase = $amount;

                TournamentReward::create([
                    'tournament_id' => $tournament->id,
                    'place' => $place,
                    'user_id' => $userId,
                    'reward_amount_fcfa' => $amount,
                    'min_purchase_amount_fcfa' => $minPurchase,
                    'credited_at' => now(),
                ]);

                $wallet = WalletAccount::where('user_id', $userId)->lockForUpdate()->first();
                if (!$wallet) {
                    $wallet = WalletAccount::create([
                        'user_id' => $userId,
                        'wallet_id' => 'DBW-' . (string) Str::ulid(),
                        'currency' => 'FCFA',
                        'balance' => 0,
                        'bonus_balance' => 0,
                        'reward_balance' => 0,
                        'reward_min_purchase_amount' => null,
                        'bonus_expires_at' => null,
                        'status' => 'active',
                    ]);
                    $wallet = WalletAccount::where('id', $wallet->id)->lockForUpdate()->first();
                }

                if (empty($wallet->wallet_id)) {
                    $wallet->wallet_id = 'DBW-' . (string) Str::ulid();
                }

                $wallet->reward_balance = (float) ($wallet->reward_balance ?? 0) + $amount;

                $existingMin = (float) ($wallet->reward_min_purchase_amount ?? 0);
                if ($existingMin <= 0) {
                    $wallet->reward_min_purchase_amount = $minPurchase;
                } else {
                    $wallet->reward_min_purchase_amount = max($existingMin, $minPurchase);
                }

                $wallet->save();

                WalletTransaction::create([
                    'wallet_account_id' => $wallet->id,
                    'wallet_bucket' => 'reward',
                    'type' => 'credit',
                    'amount' => $amount,
                    'reference' => 'TRW-' . $tournament->id . '-' . $place . '-' . strtoupper(Str::random(10)),
                    'meta' => [
                        'type' => 'tournament_reward_credit',
                        'tournament_id' => $tournament->id,
                        'place' => $place,
                        'min_purchase_amount_fcfa' => $minPurchase,
                    ],
                    'status' => 'success',
                ]);
            }

            $tournament->rewards_published_at = now();
            $tournament->rewards_banner_expires_at = now()->addDays(2);
            $tournament->save();
        });

        $tournament->refresh();
        $tournament->load(['rewards.user:id,name,email']);

        $this->sendRewardAnnouncementEmails($tournament);

        return response()->json([
            'message' => 'Récompenses publiées avec succès.',
            'tournament_id' => $tournament->id,
            'rewards_published_at' => $tournament->rewards_published_at,
            'rewards_banner_expires_at' => $tournament->rewards_banner_expires_at,
            'winners' => $tournament->rewards
                ->sortBy('place')
                ->values()
                ->map(fn (TournamentReward $reward) => [
                    'place' => (int) $reward->place,
                    'user_id' => (int) $reward->user_id,
                    'user_name' => (string) ($reward->user?->name ?? ''),
                    'reward_amount_fcfa' => (int) $reward->reward_amount_fcfa,
                    'min_purchase_amount_fcfa' => (int) $reward->min_purchase_amount_fcfa,
                ]),
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

    private function sendRewardAnnouncementEmails(Tournament $tournament): void
    {
        $tournament->loadMissing(['rewards.user:id,name,email']);

        $rewardRows = $tournament->rewards
            ->sortBy('place')
            ->values();

        if ($rewardRows->isEmpty()) {
            return;
        }

        $registrations = TournamentRegistration::query()
            ->with('user:id,name,email')
            ->where('tournament_id', $tournament->id)
            ->get();

        /** @var LoggedEmailService $logged */
        $logged = app(LoggedEmailService::class);

        $subjectAll = 'Résultats du tournoi - ' . $tournament->name;
        $tournamentUrl = $this->frontendUrl('/tournois/' . $tournament->slug);

        $winnerDetails = $rewardRows->map(function (TournamentReward $reward) {
            $place = (int) $reward->place;
            $placeLabel = $place === 1 ? '1ère place' : $place . 'ème place';
            return [
                'label' => $placeLabel,
                'value' => trim(sprintf('%s - %s FCFA', (string) ($reward->user?->name ?? 'Gagnant'), number_format((int) $reward->reward_amount_fcfa, 0, ',', ' '))),
            ];
        })->all();

        foreach ($registrations as $registration) {
            $user = $registration->user;
            if (!$user || empty($user->email)) {
                continue;
            }

            $mailable = new TemplatedNotification(
                'tournament_rewards_published',
                $subjectAll,
                [
                    'tournament' => $tournament->toArray(),
                    'registration' => $registration->toArray(),
                    'winners' => $rewardRows->map(fn (TournamentReward $reward) => [
                        'place' => (int) $reward->place,
                        'name' => (string) ($reward->user?->name ?? ''),
                        'amount' => (int) $reward->reward_amount_fcfa,
                    ])->all(),
                ],
                [
                    'title' => $subjectAll,
                    'headline' => 'Classement du tournoi',
                    'intro' => 'Les gagnants ont été annoncés. Merci pour votre participation.',
                    'details' => $winnerDetails,
                    'actionUrl' => $tournamentUrl,
                    'actionText' => 'Voir le tournoi',
                ]
            );

            $logged->queue(
                $user->id,
                (string) $user->email,
                'tournament_rewards_published',
                $subjectAll,
                $mailable,
                [
                    'tournament_id' => $tournament->id,
                    'registration_id' => $registration->id,
                ]
            );
        }

        foreach ($rewardRows as $reward) {
            $winner = $reward->user;
            if (!$winner || empty($winner->email)) {
                continue;
            }

            $subjectWinner = 'Félicitations ! Récompense créditée - ' . $tournament->name;

            $winnerMail = new TemplatedNotification(
                'tournament_reward_winner',
                $subjectWinner,
                [
                    'tournament' => $tournament->toArray(),
                    'winner' => $winner->toArray(),
                    'reward' => $reward->toArray(),
                ],
                [
                    'title' => $subjectWinner,
                    'headline' => 'Votre récompense est disponible',
                    'intro' => 'Votre gain a été crédité dans votre wallet récompense.',
                    'details' => [
                        ['label' => 'Tournoi', 'value' => (string) $tournament->name],
                        ['label' => 'Classement', 'value' => (string) ((int) $reward->place . 'e place')],
                        ['label' => 'Montant', 'value' => number_format((int) $reward->reward_amount_fcfa, 0, ',', ' ') . ' FCFA'],
                        ['label' => 'Achat minimum', 'value' => number_format((int) $reward->min_purchase_amount_fcfa, 0, ',', ' ') . ' FCFA'],
                    ],
                    'actionUrl' => $this->frontendUrl('/wallet'),
                    'actionText' => 'Ouvrir mon wallet',
                ]
            );

            $logged->queue(
                $winner->id,
                (string) $winner->email,
                'tournament_reward_winner',
                $subjectWinner,
                $winnerMail,
                [
                    'tournament_id' => $tournament->id,
                    'reward_place' => (int) $reward->place,
                    'reward_amount_fcfa' => (int) $reward->reward_amount_fcfa,
                ]
            );
        }
    }
}
