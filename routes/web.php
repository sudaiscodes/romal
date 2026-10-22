<?php

use App\Http\Controllers\ApiController;
use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

    Route::get('/forgot-password', [AuthController::class, 'showForgot']);
    Route::post('/forgot-password', [AuthController::class, 'sendLink'])->middleware('throttle:3,1');
    Route::get('/reset-password/{token}', [AuthController::class, 'showReset'])->name('password.reset');
    Route::post('/reset-password', [AuthController::class, 'reset']);
});

Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth')->name('logout');

Route::middleware('auth')->group(function () {
    Route::get('/', function () {
        $html = file_get_contents(resource_path('app.html'));
        $meta = '<meta name="csrf-token" content="'.csrf_token().'">';

        return response(str_replace('</head>', $meta.'</head>', $html))
            ->header('Cache-Control', 'no-cache, no-store, must-revalidate, private')
            ->header('Pragma', 'no-cache')
            ->header('Expires', '0');
    });

    Route::prefix('api')->controller(ApiController::class)->group(function () {
        Route::get('bootstrap', 'bootstrap');
        Route::put('profile', 'updateProfile');
        Route::post('parties', 'storeParty');
        Route::put('parties/{party}', 'updateParty');
        Route::delete('parties/{party}', 'destroyParty');
        Route::post('varieties', 'storeVariety');
        Route::put('varieties/{variety}', 'updateVariety');
        Route::delete('varieties/{variety}', 'destroyVariety');
        Route::post('invoices', 'storeInvoice');
        Route::put('invoices/{invoice}', 'updateInvoice');
        Route::delete('invoices/{invoice}', 'destroyInvoice');
        Route::post('payments', 'storePayment');
        Route::put('payments/{entry}', 'updatePayment');
        Route::delete('payments/{entry}', 'destroyPayment');
        Route::get('history', 'history');
    });
});
