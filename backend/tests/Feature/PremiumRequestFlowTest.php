<?php

namespace Tests\Feature;

use App\Models\PremiumRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PremiumRequestFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Storage::fake('public');
        config(['filesystems.public_uploads_disk' => 'public']);
    }

    public function test_user_can_submit_a_premium_request(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user, 'sanctum')
            ->postJson('/api/premium/request', [
                'level' => 'bronze',
                'social_platform' => 'TikTok',
                'social_handle' => '@primecreator',
                'social_url' => 'https://example.com/primecreator',
                'followers_count' => 3200,
                'other_platforms' => "YouTube 1200\nInstagram 900",
                'promotion_channels' => "Shorts\nStories",
                'motivation' => 'Je peux publier deux videos par semaine sur PRIME Gaming.',
            ]);

        $response->assertOk()->assertJsonPath('request.status', 'pending');

        $this->assertDatabaseHas('premium_requests', [
            'user_id' => $user->id,
            'level' => 'bronze',
            'status' => 'pending',
        ]);
    }

    public function test_admin_can_approve_a_premium_request(): void
    {
        $user = User::factory()->create(['email' => 'creator@example.com']);
        $admin = User::factory()->create(['role' => 'admin']);

        $request = PremiumRequest::query()->create([
            'user_id' => $user->id,
            'level' => 'platine',
            'status' => 'pending',
            'social_platform' => 'Instagram',
            'followers_count' => 12000,
            'motivation' => 'Audience validee et forte activite.',
        ]);

        $response = $this
            ->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/premium/requests/' . $request->id . '/approve', [
                'admin_note' => 'Audience conforme et dossier complet.',
            ]);

        $response->assertOk()->assertJsonPath('request.status', 'approved');

        $this->assertDatabaseHas('premium_requests', [
            'id' => $request->id,
            'status' => 'approved',
        ]);
        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'is_premium' => true,
            'premium_level' => 'platine',
        ]);
    }

    public function test_admin_can_refuse_a_premium_request_without_sending_email(): void
    {
        $user = User::factory()->create();
        $admin = User::factory()->create(['role' => 'admin']);

        $request = PremiumRequest::query()->create([
            'user_id' => $user->id,
            'level' => 'bronze',
            'status' => 'pending',
            'social_platform' => 'YouTube',
            'followers_count' => 250,
            'motivation' => 'Je veux tester le programme.',
        ]);

        $response = $this
            ->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/premium/requests/' . $request->id . '/refuse', [
                'admin_note' => 'Dossier insuffisant pour le moment.',
                'rejection_reasons' => "Audience insuffisante\nProfil social non verifiable",
                'send_email' => false,
            ]);

        $response->assertOk()->assertJsonPath('request.status', 'refused');

        $this->assertDatabaseHas('premium_requests', [
            'id' => $request->id,
            'status' => 'refused',
            'send_refusal_email' => false,
        ]);
    }
}