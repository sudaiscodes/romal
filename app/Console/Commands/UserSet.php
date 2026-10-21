<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class UserSet extends Command
{
    protected $signature = 'user:set {username} {email} {password} {--admin} {--disable}';
    protected $description = 'Create a user, or update an existing one';

    public function handle()
    {
        $u = User::where('username', $this->argument('username'))->first() ?? new User();
        $u->username = $this->argument('username');
        $u->email = $this->argument('email');
        $u->name = $u->name ?: $this->argument('username');
        $u->password = $this->argument('password');
        $u->role = $this->option('admin') ? 'admin' : ($u->role ?: 'staff');
        $u->is_active = !$this->option('disable');
        $u->save();

        $this->info("Saved {$u->username} ({$u->role})");
    }
}