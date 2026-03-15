<?php

namespace App\Services;

use App\Mail\TemplatedNotification;
use App\Models\Notification;
use App\Models\PremiumRequest;
use App\Models\User;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class PremiumPartnershipService
{
    public function __construct(
        private AdminResponsibilityService $responsibilities,
        private LoggedEmailService $loggedEmailService,
    ) {
    }

    public function planCatalog(): array
    {
        return [
            'bronze' => [
                'label' => 'Bronze',
                'earnings_ceiling' => 'Gagnez jusqu\'a 30 000 FCFA',
                'benefits' => [
                    'Abonnement Weekly',
                    '-5% recharge & abonnements',
                    '-15% articles gaming',
                    'Parrainage (gagnez 10% sur l\'achat payé par tes filleuls.)',
                ],
                'referral_rate' => 0.10,
                'discounts' => [
                    'recharge' => 5.0,
                    'subscription' => 5.0,
                    'item' => 15.0,
                ],
                'requirements' => [
                    'Créer des vidéos sur PRIMEgaming.space ou Kingleague.space.',
                    'Mettre en avant l\'application PRIME Gaming disponible sur le Play Store.',
                    'Publier sur YouTube, Instagram et, si possible, WhatsApp.',
                    'Maintenir un rythme de 1 à 2 vidéos par semaine.',
                ],
            ],
            'platine' => [
                'label' => 'Platine',
                'earnings_ceiling' => 'On peux gagné jusqu\'a 100 000 FCFA',
                'benefits' => [
                    'Abonnement Weekly',
                    '-8% recharge & abonnements',
                    '-25% articles gaming',
                    'Parrainage (gagnez 18% sur l\'achat payé par tes filleuls.)',
                ],
                'referral_rate' => 0.18,
                'discounts' => [
                    'recharge' => 8.0,
                    'subscription' => 8.0,
                    'item' => 25.0,
                ],
                'requirements' => [
                    'Respecter toutes les directives du plan Bronze.',
                    'Disposer d\'au moins 10 000 abonnés ou membres sur TikTok, Instagram, Discord ou une plateforme équivalente.',
                    'Publier régulièrement du contenu vidéo à forte visibilité autour de PRIME Gaming et KING League.',
                ],
            ],
        ];
    }

    public function submit(User $user, array $data): PremiumRequest
    {
        $level = $this->normalizeLevel((string) ($data['level'] ?? 'bronze'));

        if ($user->is_premium && strtolower(trim((string) $user->premium_level)) === $level) {
            throw ValidationException::withMessages([
                'level' => 'Ce plan est déjà actif sur ton compte.',
            ]);
        }

        $pending = PremiumRequest::query()
            ->where('user_id', $user->id)
            ->where('status', 'pending')
            ->first();

        if ($pending) {
            throw ValidationException::withMessages([
                'request' => 'Une demande Premium est déjà en attente.',
            ]);
        }

        $request = PremiumRequest::query()->create([
            'user_id' => $user->id,
            'level' => $level,
            'status' => 'pending',
            'social_platform' => $this->cleanNullable($data['social_platform'] ?? null),
            'social_handle' => $this->cleanNullable($data['social_handle'] ?? null),
            'social_url' => $this->cleanNullable($data['social_url'] ?? null),
            'followers_count' => max(0, (int) ($data['followers_count'] ?? 0)),
            'other_platforms' => $this->normalizeLinesToArray($data['other_platforms'] ?? null),
            'motivation' => $this->cleanNullable($data['motivation'] ?? null),
            'promotion_channels' => $this->normalizeLinesToArray($data['promotion_channels'] ?? null),
        ]);

        Notification::query()->create([
            'user_id' => $user->id,
            'type' => 'premium_request_submitted',
            'message' => 'Ta demande Premium a été envoyée à l\'équipe PRIME pour validation.',
        ]);

        $plan = $this->planCatalog()[$level];

        $this->responsibilities->notify(
            'partnerships',
            'premium_request_submitted',
            'Nouvelle demande Premium à valider',
            [
                'headline' => 'Nouvelle demande Premium',
                'intro' => 'Une nouvelle demande Premium attend une validation admin.',
                'details' => [
                    ['label' => 'Utilisateur', 'value' => (string) ($user->name ?? '—')],
                    ['label' => 'Email', 'value' => (string) ($user->email ?? '—')],
                    ['label' => 'Plan', 'value' => (string) $plan['label']],
                    ['label' => 'Audience déclarée', 'value' => number_format((int) $request->followers_count, 0, ',', ' ')],
                ],
            ],
            [
                'user' => $user->toArray(),
                'premium_request' => $request->toArray(),
            ],
            [
                'premium_request_id' => $request->id,
            ]
        );

        return $request->fresh('user');
    }

    public function approve(PremiumRequest $premiumRequest, User $admin, ?string $adminNote = null): PremiumRequest
    {
        if ((string) $premiumRequest->status !== 'pending') {
            throw ValidationException::withMessages([
                'request' => 'Seules les demandes en attente peuvent être approuvées.',
            ]);
        }

        $premiumRequest->loadMissing('user');
        $user = $premiumRequest->user;
        if (!$user) {
            throw ValidationException::withMessages([
                'user' => 'Utilisateur introuvable pour cette demande.',
            ]);
        }

        $level = $this->normalizeLevel((string) $premiumRequest->level);
        $plan = $this->planCatalog()[$level];
        $now = now();

        $conditionsPdf = $this->renderPdf('premium-approval-conditions', [
            'user' => $user,
            'request' => $premiumRequest,
            'plan' => $plan,
            'issuedAt' => $now,
        ]);
        $certificatePdf = $this->renderPdf('premium-partnership-certificate', [
            'user' => $user,
            'request' => $premiumRequest,
            'plan' => $plan,
            'issuedAt' => $now,
            'certificateCode' => sprintf('PRM-%d-%s', (int) $user->id, strtoupper(substr(md5((string) $now), 0, 8))),
        ]);

        $conditionsPath = $this->storePdf($user->id, sprintf('premium-conditions-%s-%d.pdf', $level, $premiumRequest->id), $conditionsPdf);
        $certificatePath = $this->storePdf($user->id, sprintf('premium-certificate-%s-%d.pdf', $level, $premiumRequest->id), $certificatePdf);

        DB::transaction(function () use ($premiumRequest, $user, $admin, $adminNote, $level, $conditionsPath, $certificatePath, $now) {
            PremiumRequest::query()
                ->where('user_id', $user->id)
                ->where('status', 'pending')
                ->where('id', '!=', $premiumRequest->id)
                ->update([
                    'status' => 'refused',
                    'admin_note' => 'Demande remplacée par une validation plus récente.',
                    'processed_by_admin_id' => $admin->id,
                    'processed_at' => $now,
                    'refused_at' => $now,
                    'send_refusal_email' => false,
                ]);

            $premiumRequest->update([
                'status' => 'approved',
                'admin_note' => $this->cleanNullable($adminNote),
                'processed_by_admin_id' => $admin->id,
                'processed_at' => $now,
                'approved_at' => $now,
                'conditions_pdf_path' => $conditionsPath,
                'certificate_pdf_path' => $certificatePath,
            ]);

            $user->update([
                'is_premium' => true,
                'premium_level' => $level,
                'premium_tier' => Arr::get($this->planCatalog(), $level . '.label'),
                'premium_expiration' => null,
            ]);

            Notification::query()->create([
                'user_id' => $user->id,
                'type' => 'premium_request_approved',
                'message' => 'Ta demande Premium a été approuvée. Vérifie ton email pour récupérer les documents.',
            ]);
        });

        if (filled($user->email)) {
            $subject = 'Demande Premium approuvée - PRIME Gaming';
            $mailable = (new TemplatedNotification(
                'premium_request_approved',
                $subject,
                [
                    'user' => $user->toArray(),
                    'premium_request' => $premiumRequest->fresh()->toArray(),
                    'plan' => $plan,
                ],
                [
                    'title' => $subject,
                    'headline' => 'Prime est heureux de t\'annoncer que ta demande a été acceptée.',
                    'intro' => 'Tu fais désormais partie du programme partenaire PRIME Gaming et KING League. Les directives et ton certificat sont joints à ce message.',
                    'details' => [
                        ['label' => 'Plan', 'value' => (string) $plan['label']],
                        ['label' => 'Plafond de gains', 'value' => (string) $plan['earnings_ceiling']],
                        ['label' => 'Parrainage', 'value' => (int) round(((float) $plan['referral_rate']) * 100) . '%'],
                    ],
                    'outro' => 'Merci de respecter les directives du programme et de publier régulièrement tes contenus.',
                ]
            ))
                ->attachData($conditionsPdf, 'directives-premium-' . $level . '.pdf', ['mime' => 'application/pdf'])
                ->attachData($certificatePdf, 'certificat-partenariat-' . $level . '.pdf', ['mime' => 'application/pdf']);

            $queued = $this->loggedEmailService->queue(
                $user->id,
                (string) $user->email,
                'premium_request_approved',
                $subject,
                $mailable,
                ['premium_request_id' => $premiumRequest->id]
            );

            if ($queued) {
                $premiumRequest->forceFill([
                    'decision_email_sent_at' => now(),
                ])->save();
            }
        }

        return $premiumRequest->fresh(['user', 'processor']);
    }

    public function refuse(PremiumRequest $premiumRequest, User $admin, array $data): PremiumRequest
    {
        if ((string) $premiumRequest->status !== 'pending') {
            throw ValidationException::withMessages([
                'request' => 'Seules les demandes en attente peuvent être refusées.',
            ]);
        }

        $premiumRequest->loadMissing('user');
        $user = $premiumRequest->user;
        if (!$user) {
            throw ValidationException::withMessages([
                'user' => 'Utilisateur introuvable pour cette demande.',
            ]);
        }

        $reasons = $this->normalizeLinesToArray($data['rejection_reasons'] ?? null);
        if (empty($reasons)) {
            throw ValidationException::withMessages([
                'rejection_reasons' => 'Ajoute au moins une condition non respectée.',
            ]);
        }

        $adminNote = $this->cleanNullable($data['admin_note'] ?? null);
        $sendEmail = (bool) ($data['send_email'] ?? false);
        $now = now();
        $plan = $this->planCatalog()[$this->normalizeLevel((string) $premiumRequest->level)];

        $refusalPdf = $this->renderPdf('premium-refusal-summary', [
            'user' => $user,
            'request' => $premiumRequest,
            'plan' => $plan,
            'issuedAt' => $now,
            'reasons' => $reasons,
            'adminNote' => $adminNote,
        ]);
        $refusalPath = $this->storePdf($user->id, sprintf('premium-refusal-%s-%d.pdf', $premiumRequest->level, $premiumRequest->id), $refusalPdf);

        $premiumRequest->update([
            'status' => 'refused',
            'admin_note' => $adminNote,
            'rejection_reasons' => $reasons,
            'send_refusal_email' => $sendEmail,
            'processed_by_admin_id' => $admin->id,
            'processed_at' => $now,
            'refused_at' => $now,
            'refusal_pdf_path' => $refusalPath,
        ]);

        Notification::query()->create([
            'user_id' => $user->id,
            'type' => 'premium_request_refused',
            'message' => 'Ta demande Premium a été refusée. Consulte la notification pour les conditions manquantes.',
        ]);

        if ($sendEmail && filled($user->email)) {
            $subject = 'Demande Premium refusée - PRIME Gaming';
            $mailable = (new TemplatedNotification(
                'premium_request_refused',
                $subject,
                [
                    'user' => $user->toArray(),
                    'premium_request' => $premiumRequest->fresh()->toArray(),
                    'plan' => $plan,
                    'reasons' => $reasons,
                ],
                [
                    'title' => $subject,
                    'headline' => 'Ta demande Premium n\'a pas encore été validée.',
                    'intro' => 'L\'équipe PRIME a refusé la demande actuelle. Le récapitulatif des conditions non remplies est joint en PDF.',
                    'details' => array_merge(
                        [
                            ['label' => 'Plan demandé', 'value' => (string) $plan['label']],
                        ],
                        array_map(fn (string $reason) => ['label' => 'Condition manquante', 'value' => $reason], $reasons)
                    ),
                    'outro' => $adminNote ?: 'Tu peux corriger ton dossier puis soumettre une nouvelle demande.',
                ]
            ))->attachData($refusalPdf, 'refus-premium-' . $premiumRequest->level . '.pdf', ['mime' => 'application/pdf']);

            $queued = $this->loggedEmailService->queue(
                $user->id,
                (string) $user->email,
                'premium_request_refused',
                $subject,
                $mailable,
                ['premium_request_id' => $premiumRequest->id]
            );

            if ($queued) {
                $premiumRequest->forceFill([
                    'decision_email_sent_at' => now(),
                ])->save();
            }
        }

        return $premiumRequest->fresh(['user', 'processor']);
    }

    public function serializeForApi(?PremiumRequest $premiumRequest): ?array
    {
        if (!$premiumRequest) {
            return null;
        }

        $diskName = (string) (config('filesystems.public_uploads_disk') ?: 'public');
        $disk = Storage::disk($diskName);

        return [
            'id' => $premiumRequest->id,
            'level' => $premiumRequest->level,
            'status' => $premiumRequest->status,
            'social_platform' => $premiumRequest->social_platform,
            'social_handle' => $premiumRequest->social_handle,
            'social_url' => $premiumRequest->social_url,
            'followers_count' => (int) $premiumRequest->followers_count,
            'other_platforms' => $premiumRequest->other_platforms ?? [],
            'promotion_channels' => $premiumRequest->promotion_channels ?? [],
            'motivation' => $premiumRequest->motivation,
            'admin_note' => $premiumRequest->admin_note,
            'rejection_reasons' => $premiumRequest->rejection_reasons ?? [],
            'send_refusal_email' => (bool) $premiumRequest->send_refusal_email,
            'processed_at' => optional($premiumRequest->processed_at)?->toIso8601String(),
            'approved_at' => optional($premiumRequest->approved_at)?->toIso8601String(),
            'refused_at' => optional($premiumRequest->refused_at)?->toIso8601String(),
            'created_at' => optional($premiumRequest->created_at)?->toIso8601String(),
            'conditions_pdf_url' => $premiumRequest->conditions_pdf_path ? $disk->url($premiumRequest->conditions_pdf_path) : null,
            'certificate_pdf_url' => $premiumRequest->certificate_pdf_path ? $disk->url($premiumRequest->certificate_pdf_path) : null,
            'refusal_pdf_url' => $premiumRequest->refusal_pdf_path ? $disk->url($premiumRequest->refusal_pdf_path) : null,
        ];
    }

    private function normalizeLevel(string $level): string
    {
        $normalized = strtolower(trim($level));
        return array_key_exists($normalized, $this->planCatalog()) ? $normalized : 'bronze';
    }

    private function cleanNullable(mixed $value): ?string
    {
        $clean = trim((string) $value);
        return $clean === '' ? null : $clean;
    }

    private function normalizeLinesToArray(mixed $value): array
    {
        if (is_array($value)) {
            $items = $value;
        } else {
            $items = preg_split('/\r\n|\r|\n/', (string) $value) ?: [];
        }

        return array_values(array_filter(array_map(function ($item) {
            $clean = trim((string) $item);
            return $clean === '' ? null : $clean;
        }, $items)));
    }

    private function renderPdf(string $view, array $data): string
    {
        $html = view($view, $data)->render();

        $options = new Options();
        $options->set('isRemoteEnabled', false);

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4');
        $dompdf->render();

        return $dompdf->output();
    }

    private function storePdf(int $userId, string $filename, string $pdfBytes): string
    {
        $diskName = (string) (config('filesystems.public_uploads_disk') ?: 'public');
        $path = sprintf('premium-requests/user-%d/%s', $userId, $filename);

        Storage::disk($diskName)->put($path, $pdfBytes, [
            'visibility' => 'public',
        ]);

        return $path;
    }
}