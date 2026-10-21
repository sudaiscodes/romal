<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(array $attributes = []): User
    {
        $user = User::factory()->create(['email' => 'faisal@example.com', ...$attributes]);
        $user->forceFill(['username' => 'faisal'])->save();

        return $user;
    }

    public function test_user_can_log_in_with_username(): void
    {
        $user = $this->makeUser();

        $this->post('/login', ['login' => 'faisal', 'password' => 'password'])->assertRedirect('/');

        $this->assertAuthenticatedAs($user);
    }

    public function test_user_can_log_in_with_email(): void
    {
        $user = $this->makeUser();

        $this->post('/login', ['login' => 'faisal@example.com', 'password' => 'password'])->assertRedirect('/');

        $this->assertAuthenticatedAs($user);
    }

    public function test_wrong_password_is_rejected(): void
    {
        $this->makeUser();

        $this->from('/login')->post('/login', ['login' => 'faisal@example.com', 'password' => 'wrong'])
            ->assertRedirect('/login')
            ->assertSessionHasErrors('login');

        $this->assertGuest();
    }

    public function test_inactive_user_cannot_log_in(): void
    {
        $user = $this->makeUser();
        $user->forceFill(['is_active' => false])->save();

        $this->post('/login', ['login' => 'faisal@example.com', 'password' => 'password']);

        $this->assertGuest();
    }

    public function test_app_page_is_not_cached_so_back_button_cannot_show_it_after_logout(): void
    {
        $response = $this->actingAs($this->makeUser())->get('/');

        $response->assertOk();
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
    }

    public function test_after_logout_the_app_redirects_to_login(): void
    {
        $this->actingAs($this->makeUser())->post('/logout')->assertRedirect('/login');

        $this->get('/')->assertRedirect('/login');
    }
}
