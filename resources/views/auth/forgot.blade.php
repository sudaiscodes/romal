@extends('auth.layout')
@section('title', 'Forgot password')
@section('content')
<form method="POST" action="/forgot-password">
  @csrf
  <h1>Reset password</h1>
  @if(session('status'))<div class="ok">{{ session('status') }}</div>@endif
  <label>Email</label>
  <input type="email" name="email" value="{{ old('email') }}" required autofocus>
  @error('email')<div class="err">{{ $message }}</div>@enderror
  <button type="submit">Send reset link</button>
  <a href="/login">Back to login</a>
</form>
@endsection