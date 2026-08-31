<?php

use App\Http\Controllers\Api\BuildingController;
use App\Http\Controllers\Api\CampusController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\FacultyController;
use App\Http\Controllers\Api\FloorController;
use App\Http\Controllers\Api\RoomController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Module 4 — University organization structure
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::apiResource('campuses', CampusController::class)->except(['edit', 'create']);
    Route::apiResource('faculties', FacultyController::class)->except(['edit', 'create']);
    Route::apiResource('departments', DepartmentController::class)->except(['edit', 'create']);
    Route::apiResource('buildings', BuildingController::class)->except(['edit', 'create']);
    Route::apiResource('floors', FloorController::class)->except(['edit', 'create']);
    Route::apiResource('rooms', RoomController::class)->except(['edit', 'create']);
});
