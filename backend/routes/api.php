<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| KU-AMS API Routes
|--------------------------------------------------------------------------
|
| The API is versioned through the `api` prefix. Module route groups are
| added phase by phase:
|
|   Phase 2  - Auth          routes/api/auth.php        (login, logout, me, change-password)
|   Phase 3  - Users/Roles   routes/api/users.php       (users, roles, permissions)
|   Phase 4  - Organization  routes/api/organization.php (campuses…rooms)
|   Phase 5  - Assets        routes/api/assets.php      (categories, assets, files)
|   Phase 6  - Operations    routes/api/operations.php  (assignments, transfers, requests)
|   Phase 7  - Maintenance   routes/api/maintenance.php
|   Phase 8  - Codes         routes/api/codes.php        (QR / barcode)
|   Phase 9  - Incidents     routes/api/incidents.php
|   Phase 10 - Procurement   routes/api/procurement.php  (suppliers, PR, PO, receipts)
|   Phase 11 - Warehouse     routes/api/warehouse.php
|   Phase 12 - Audit         routes/api/audit.php
|   Phase 13 - Financial     routes/api/financial.php    (depreciation, disposal)
|   Phase 14 - System        routes/api/system.php       (notifications, logs, reports, dashboard, settings)
|
*/

require __DIR__.'/api/auth.php';

|   Phase 4  - Organization  routes/api/organization.php (campuses…rooms)
|   Phase 5  - Assets        routes/api/assets.php      (categories, assets, files)
|   Phase 6  - Operations    routes/api/operations.php  (assignments, transfers, requests)
|   Phase 7  - Maintenance   routes/api/maintenance.php
|   Phase 8  - Codes         routes/api/codes.php        (QR / barcode)
|   Phase 9  - Incidents     routes/api/incidents.php
|   Phase 10 - Procurement   routes/api/procurement.php  (suppliers, PR, PO, receipts)
|   Phase 11 - Warehouse     routes/api/warehouse.php
|   Phase 12 - Audit         routes/api/audit.php
|   Phase 13 - Financial     routes/api/financial.php    (depreciation, disposal)
|   Phase 14 - System        routes/api/system.php       (notifications, logs, reports, dashboard, settings)
|
*/

Route::get('/', function () {
    return response()->json([
        'success' => true,
        'message' => 'Kabul University Asset Management System API',
        'data' => [
            'name' => 'KU-AMS',
            'version' => '1.0.0',
        ],
    ]);
});

// Authenticated user snapshot (used by the frontend bootstrap guard).
Route::middleware(['auth:sanctum'])->get('/user', function (Request $request) {
    return response()->json([
        'success' => true,
        'message' => 'Authenticated user retrieved successfully.',
        'data' => [
            'user' => $request->user()->load('roles.permissions'),
        ],
    ]);
});
