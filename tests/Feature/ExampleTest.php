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

    public function test_bootstrap_returns_the_logged_in_user(): void
    {
        $user = User::factory()->create(['name' => 'Haji Faisal', 'email' => 'faisal@example.com']);

        $this->actingAs($user)->getJson('/api/bootstrap')
            ->assertOk()
            ->assertJsonPath('user', ['name' => 'Haji Faisal', 'email' => 'faisal@example.com']);
    }
}
