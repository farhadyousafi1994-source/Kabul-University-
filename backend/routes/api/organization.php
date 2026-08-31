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
    // Campuses, faculties, departments, buildings, floors, rooms.
    foreach ([
        'campuses' => ['controller' => CampusController::class, 'param' => 'campus'],
        'faculties' => ['controller' => FacultyController::class, 'param' => 'faculty'],
        'departments' => ['controller' => DepartmentController::class, 'param' => 'department'],
        'buildings' => ['controller' => BuildingController::class, 'param' => 'building'],
        'floors' => ['controller' => FloorController::class, 'param' => 'floor'],
        'rooms' => ['controller' => RoomController::class, 'param' => 'room'],
    ] as $resource => $config) {
        $controller = $config['controller'];
        $param = $config['param'];

        Route::get($resource, [$controller, 'index'])->middleware('permission:organization.view');
        Route::post($resource, [$controller, 'store'])->middleware('permission:organization.create');
        Route::get($resource.'/{'.$param.'}', [$controller, 'show'])->middleware('permission:organization.view');
        Route::put($resource.'/{'.$param.'}', [$controller, 'update'])->middleware('permission:organization.update');
        Route::patch($resource.'/{'.$param.'}', [$controller, 'update'])->middleware('permission:organization.update');
        Route::delete($resource.'/{'.$param.'}', [$controller, 'destroy'])->middleware('permission:organization.delete');
    }
});
