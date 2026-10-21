<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>@yield('title')</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #f4f6f8;
      display: flex;
      min-height: 100vh;
      align-items: center;
      justify-content: center;
      margin: 0
    }

    form {
      background: #fff;
      padding: 32px;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, .08);
      width: 320px
    }

    h1 {
      font-size: 20px;
      margin: 0 0 20px
    }

    label {
      display: block;
      font-size: 13px;
      margin: 12px 0 4px
    }

    input[type=text],
    input[type=email],
    input[type=password] {
      width: 100%;
      padding: 10px;
      border: 1px solid #ccd;
      border-radius: 8px;
      box-sizing: border-box
    }

    button {
      width: 100%;
      margin-top: 20px;
      padding: 11px;
      border: 0;
      border-radius: 8px;
      background: #1B3A57;
      transition: 0.3s;
      color: #fff;
      font-size: 15px;
      cursor: pointer
    }

    button:hover{
      background-color: #2C3E50;
    }

    .err {
      color: #b91c1c;
      font-size: 13px;
      margin-top: 8px
    }

    .ok {
      color: #2C3E50;
      font-size: 13px;
      margin-bottom: 8px
    }

    a {
      color: #1B3A57;
      font-size: 13px;
      display: block;
      margin-top: 14px;
      text-align: center
    }
  </style>
</head>

<body>
  @yield('content')
</body>

</html>