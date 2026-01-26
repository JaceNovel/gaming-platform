<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $email = config('admin.owner_email');
        $password = config('admin.owner_password');

        User::updateOrCreate(
            ['email' => $email],
            [
                'name' => 'Owner Admin',
                'password' => Hash::make($password),
                'role' => 'admin_super',
            ]
        );
    }
}
