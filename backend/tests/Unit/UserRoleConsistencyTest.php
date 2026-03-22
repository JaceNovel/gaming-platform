<?php

namespace Tests\Unit;

use App\Models\User;
use App\Services\AdminResponsibilityService;
use Tests\TestCase;

class UserRoleConsistencyTest extends TestCase
{
    public function test_allowed_roles_include_default_role_and_all_admin_roles(): void
    {
        $this->assertSame(
            array_merge([User::DEFAULT_ROLE], User::ADMIN_ROLES),
            User::allowedRoles()
        );
    }

    public function test_admin_responsibility_catalog_matches_admin_roles(): void
    {
        $service = new AdminResponsibilityService();

        $this->assertEqualsCanonicalizing(User::ADMIN_ROLES, array_keys($service->roleCatalog()));
    }
}