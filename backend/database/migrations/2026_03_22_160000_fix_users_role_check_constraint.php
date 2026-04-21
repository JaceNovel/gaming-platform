<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $this->replaceRoleConstraint(User::allowedRoles());
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $this->replaceRoleConstraint([
            User::DEFAULT_ROLE,
            'viewer',
            'admin',
            'admin_super',
            'admin_manager',
            'admin_support',
            'admin_marketing',
            'admin_article',
            'admin_client',
            'staff',
        ]);
    }

    private function replaceRoleConstraint(array $roles): void
    {
        $quotedRoles = implode(',', array_map(
            static fn (string $role): string => "'" . str_replace("'", "''", $role) . "'",
            $roles
        ));

        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ({$quotedRoles}))");
    }
};