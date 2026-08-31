<?php

use App\Http\Controllers\Api\AuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Module 1 — Authentication
|
|   POST /api/login             → token + user
|   POST /api/logout            → revoke current token
|   GET  /api/me                → authenticated user
|   POST /api/change-password   → update password (revokes other tokens)
|   POST /api/forgot-password   → send reset link (password reset architecture)
|   POST /api/reset-password    → consume broker token, reset password
|--------------------------------------------------------------------------
*/

Route::post('/login', [AuthController::class, 'login'])
    ->middleware('throttle:5,1'); // 5 attempts per minute per IP

Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])
    ->middleware('throttle:3,1');

Route::post('/reset-password', [AuthController::class, 'resetPassword'])
    ->middleware('throttle:5,1');

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);
});
