@extends('auth.layout')
@section('title', 'Login')
@section('content')
<form method="POST" action="/login">
  @csrf
  <h1>Sign in</h1>
  @if(session('status'))<div class="ok">{{ session('status') }}</div>@endif
  <label for="login">Username or email</label>
  <input type="text" id="login" name="login" value="{{ old('login') }}" autocomplete="username" required autofocus>
  <label for="password">Password</label>
  <input type="password" id="password" name="password" autocomplete="current-password" required>
  @error('login')<div class="err">{{ $message }}</div>@enderror
  <button type="submit">Login</button>
  <a href="/forgot-password">Forgot password?</a>
</form>
@endsection