<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_login(): void
    {
        $this->get('/')->assertRedirect('/login');
    }

    public function test_authenticated_user_can_open_the_app(): void
    {
        $this->actingAs(User::factory()->create())->get('/')->assertOk();
    }

    public function test_app_assets_are_versioned_so_deploys_bypass_the_browser_cache(): void
    {
        $this->actingAs(User::factory()->create())->get('/')
            ->assertSee('/js/app.js?v='.filemtime(public_path('js/app.js')), false)
            ->assertSee('/css/app.css?v='.filemtime(public_path('css/app.css')), false);
    }

    public function test_bootstrap_returns_the_logged_in_user(): void
    {
        $user = User::factory()->create(['name' => 'Haji Faisal', 'email' => 'faisal@example.com']);

        $this->actingAs($user)->getJson('/api/bootstrap')
            ->assertOk()
            ->assertJsonPath('user', ['name' => 'Haji Faisal', 'email' => 'faisal@example.com']);
    }
}
