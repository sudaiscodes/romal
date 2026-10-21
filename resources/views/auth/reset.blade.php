@extends('auth.layout')
@section('title', 'New password')
@section('content')
<form method="POST" action="/reset-password">
  @csrf
  <h1>New password</h1>
  <input type="hidden" name="token" value="{{ $token }}">
  <label>Email</label>
  <input type="email" name="email" value="{{ old('email', $email) }}" required>
  <label>New password</label>
  <input type="password" name="password" required>
  <label>Confirm password</label>
  <input type="password" name="password_confirmation" required>
  @error('email')<div class="err">{{ $message }}</div>@enderror
  @error('password')<div class="err">{{ $message }}</div>@enderror
  <button type="submit">Change password</button>
</form>
@endsection