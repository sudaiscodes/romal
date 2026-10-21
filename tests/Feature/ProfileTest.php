<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_update_their_name(): void
    {
        $user = User::factory()->create(['name' => 'Old Name', 'email' => 'faisal@example.com']);

        $this->actingAs($user)->putJson('/api/profile', ['name' => '  Haji Faisal  '])
            ->assertOk()
            ->assertExactJson(['name' => 'Haji Faisal', 'email' => 'faisal@example.com']);

        $this->assertSame('Haji Faisal', $user->fresh()->name);
    }

    public function test_name_is_required(): void
    {
        $user = User::factory()->create(['name' => 'Old Name']);

        $this->actingAs($user)->putJson('/api/profile', ['name' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        $this->assertSame('Old Name', $user->fresh()->name);
    }

    public function test_guests_cannot_update_a_profile(): void
    {
        $this->putJson('/api/profile', ['name' => 'Someone'])->assertUnauthorized();
    }
}
