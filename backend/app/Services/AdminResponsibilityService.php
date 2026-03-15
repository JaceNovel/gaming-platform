<?php

namespace App\Services;

use App\Mail\TemplatedNotification;
use App\Models\SiteSetting;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

class AdminResponsibilityService
{
    private const SETTINGS_KEY = 'admin_responsibility_assignments';

    public function roleCatalog(): array
    {
        return [
            'admin_super' => [
                'label' => 'Admin superieur',
                'description' => 'Controle total de la plateforme, des parametres et des affectations.',
                'category' => 'system',
            ],
            'admin' => [
                'label' => 'Admin systeme',
                'description' => 'Admin principal avec acces complet a /admin.',
                'category' => 'system',
            ],
            'admin_operations' => [
                'label' => 'Admin operations',
                'description' => 'Abonnements, recharges, DB Wallet, vendeurs et retraits.',
                'category' => 'operations',
            ],
            'admin_domain' => [
                'label' => 'Admin domaines',
                'description' => 'Tournois, inscriptions, litiges, remboursements et partenariats.',
                'category' => 'domain',
            ],
            'admin_manager' => [
                'label' => 'Manager legacy',
                'description' => 'Ancien role conserve pour compatibilite.',
                'category' => 'legacy',
            ],
            'admin_support' => [
                'label' => 'Support legacy',
                'description' => 'Ancien role conserve pour compatibilite.',
                'category' => 'legacy',
            ],
            'admin_marketing' => [
                'label' => 'Marketing legacy',
                'description' => 'Ancien role conserve pour compatibilite.',
                'category' => 'legacy',
            ],
            'admin_article' => [
                'label' => 'Article legacy',
                'description' => 'Ancien role conserve pour compatibilite.',
                'category' => 'legacy',
            ],
            'admin_client' => [
                'label' => 'Client legacy',
                'description' => 'Ancien role conserve pour compatibilite.',
                'category' => 'legacy',
            ],
            'staff' => [
                'label' => 'Staff legacy',
                'description' => 'Ancien role conserve pour compatibilite.',
                'category' => 'legacy',
            ],
            'viewer' => [
                'label' => 'Lecteur legacy',
                'description' => 'Ancien role conserve pour compatibilite.',
                'category' => 'legacy',
            ],
        ];
    }

    public function responsibilityCatalog(): array
    {
        return [
            'subscriptions' => [
                'label' => 'Abonnements',
                'description' => 'Paiements Premium, abonnements et renouvellements.',
                'permissions' => ['subscriptions.manage', 'premium.manage'],
            ],
            'recharges' => [
                'label' => 'Recharges et DB Wallet',
                'description' => 'Top-up, codes de recharge, stock et wallet.',
                'permissions' => ['wallet.manage', 'redeems.manage', 'stock.manage', 'payments.view'],
            ],
            'sellers' => [
                'label' => 'Vendeurs',
                'description' => 'Vendeurs, annonces, commandes et retraits marketplace.',
                'permissions' => [
                    'marketplace.sellers.view',
                    'marketplace.sellers.manage',
                    'marketplace.listings.manage',
                    'marketplace.orders.manage',
                    'marketplace.withdraws.manage',
                ],
            ],
            'tournaments' => [
                'label' => 'Tournois et inscriptions',
                'description' => 'Gestion des tournois et suivi des inscriptions.',
                'permissions' => ['tournaments.view', 'tournaments.manage'],
            ],
            'disputes_refunds' => [
                'label' => 'Litiges et remboursements',
                'description' => 'Disputes marketplace, cas de remboursement et arbitrage.',
                'permissions' => ['marketplace.disputes.manage', 'orders.view', 'payments.view'],
            ],
            'partnerships' => [
                'label' => 'Partenariats',
                'description' => 'KYC vendeurs, Premium creators, onboarding partenaires et dossiers speciaux.',
                'permissions' => ['marketplace.sellers.view', 'marketplace.sellers.manage', 'marketplace.settings.manage', 'premium.manage'],
            ],
        ];
    }

    public function adminMembers(): array
    {
        $roles = $this->roleCatalog();

        return User::query()
            ->whereIn('role', array_keys($roles))
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role'])
            ->map(function (User $user) use ($roles) {
                $role = (string) $user->role;

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $role,
                    'role_label' => $roles[$role]['label'] ?? $role,
                    'permissions' => $user->permissions(),
                ];
            })
            ->values()
            ->all();
    }

    public function assignments(): array
    {
        $raw = SiteSetting::query()->where('key', self::SETTINGS_KEY)->value('value');
        if (!is_string($raw) || trim($raw) === '') {
            return $this->emptyAssignments();
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return $this->emptyAssignments();
        }

        return $this->sanitizeAssignments($decoded);
    }

    public function saveAssignments(array $assignments): array
    {
        $sanitized = $this->sanitizeAssignments($assignments);

        SiteSetting::updateOrCreate(
            ['key' => self::SETTINGS_KEY],
            ['value' => json_encode($sanitized, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]
        );

        return $sanitized;
    }

    public function usersForResponsibility(string $responsibility): Collection
    {
        $catalog = $this->responsibilityCatalog();
        if (!array_key_exists($responsibility, $catalog)) {
            return new Collection();
        }

        $assignments = $this->assignments();
        $assignedIds = array_values(array_unique(array_map('intval', (array) ($assignments[$responsibility] ?? []))));

        if (!empty($assignedIds)) {
            return User::query()
                ->whereIn('id', $assignedIds)
                ->whereIn('role', User::ADMIN_ROLES)
                ->orderBy('name')
                ->get();
        }

        $permissions = (array) ($catalog[$responsibility]['permissions'] ?? []);

        return User::query()
            ->whereIn('role', User::ADMIN_ROLES)
            ->get()
            ->filter(function (User $user) use ($permissions) {
                if (empty($permissions)) {
                    return in_array((string) $user->role, ['admin', 'admin_super'], true);
                }

                foreach ($permissions as $permission) {
                    if ($user->hasPermission((string) $permission)) {
                        return true;
                    }
                }

                return false;
            })
            ->sortBy('name')
            ->values();
    }

    public function notify(
        string $responsibility,
        string $type,
        string $subject,
        array $viewData,
        array $context = [],
        array $meta = []
    ): int {
        $recipients = $this->usersForResponsibility($responsibility)
            ->filter(fn (User $user) => filled($user->email));

        if ($recipients->isEmpty()) {
            return 0;
        }

        $sent = 0;
        $loggedEmail = app(LoggedEmailService::class);

        foreach ($recipients as $user) {
            $mailable = new TemplatedNotification(
                $type,
                $subject,
                $context,
                array_merge([
                    'title' => $subject,
                    'headline' => $viewData['headline'] ?? $subject,
                    'intro' => $viewData['intro'] ?? '',
                ], $viewData)
            );

            $queued = $loggedEmail->queue(
                $user->id,
                (string) $user->email,
                $type,
                $subject,
                $mailable,
                array_merge($meta, [
                    'responsibility' => $responsibility,
                    'admin_id' => $user->id,
                ])
            );

            if ($queued) {
                $sent++;
            }
        }

        return $sent;
    }

    public function emailsForResponsibility(string $responsibility): array
    {
        return $this->usersForResponsibility($responsibility)
            ->pluck('email')
            ->filter(fn ($email) => is_string($email) && trim($email) !== '')
            ->map(fn ($email) => strtolower(trim((string) $email)))
            ->unique()
            ->values()
            ->all();
    }

    public function sanitizeAssignments(array $assignments): array
    {
        $empty = $this->emptyAssignments();
        $allowedIds = User::query()
            ->whereIn('role', array_keys($this->roleCatalog()))
            ->pluck('id')
            ->map(fn ($value) => (int) $value)
            ->all();
        $allowedSet = array_fill_keys($allowedIds, true);

        foreach ($empty as $key => $_) {
            $ids = array_values(array_unique(array_map('intval', (array) ($assignments[$key] ?? []))));
            $empty[$key] = array_values(array_filter($ids, fn (int $id) => isset($allowedSet[$id])));
        }

        return $empty;
    }

    private function emptyAssignments(): array
    {
        $defaults = [];
        foreach (array_keys($this->responsibilityCatalog()) as $key) {
            $defaults[$key] = [];
        }

        return $defaults;
    }
}