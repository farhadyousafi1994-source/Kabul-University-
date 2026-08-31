<?php

use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\AssetFileController;
use App\Http\Controllers\Api\AssignmentController;
use App\Http\Controllers\Api\AssetRequestController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\SubcategoryController;
use App\Http\Controllers\Api\TransferController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Modules 5–10 — Categories, Assets, Files, Assignments, Transfers, Requests
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    // Categories & subcategories
    Route::get('categories', [CategoryController::class, 'index'])->middleware('permission:categories.view');
    Route::post('categories', [CategoryController::class, 'store'])->middleware('permission:categories.create');
    Route::get('categories/{category}', [CategoryController::class, 'show'])->middleware('permission:categories.view');
    Route::put('categories/{category}', [CategoryController::class, 'update'])->middleware('permission:categories.update');
    Route::patch('categories/{category}', [CategoryController::class, 'update'])->middleware('permission:categories.update');
    Route::delete('categories/{category}', [CategoryController::class, 'destroy'])->middleware('permission:categories.delete');

    Route::get('subcategories', [SubcategoryController::class, 'index'])->middleware('permission:categories.view');
    Route::post('subcategories', [SubcategoryController::class, 'store'])->middleware('permission:categories.create');
    Route::get('subcategories/{subcategory}', [SubcategoryController::class, 'show'])->middleware('permission:categories.view');
    Route::put('subcategories/{subcategory}', [SubcategoryController::class, 'update'])->middleware('permission:categories.update');
    Route::patch('subcategories/{subcategory}', [SubcategoryController::class, 'update'])->middleware('permission:categories.update');
    Route::delete('subcategories/{subcategory}', [SubcategoryController::class, 'destroy'])->middleware('permission:categories.delete');

    // Assets (core module)
    Route::get('assets/lookup', [AssetController::class, 'lookup'])->middleware('permission:assets.view');
    Route::get('assets/{asset}/timeline', [AssetController::class, 'timeline'])->middleware('permission:assets.view');
    Route::patch('assets/{asset}/status', [AssetController::class, 'changeStatus'])->middleware('permission:assets.update');
    Route::get('assets', [AssetController::class, 'index'])->middleware('permission:assets.view');
    Route::post('assets', [AssetController::class, 'store'])->middleware('permission:assets.create');
    Route::get('assets/{asset}', [AssetController::class, 'show'])->middleware('permission:assets.view');
    Route::put('assets/{asset}', [AssetController::class, 'update'])->middleware('permission:assets.update');
    Route::patch('assets/{asset}', [AssetController::class, 'update'])->middleware('permission:assets.update');
    Route::delete('assets/{asset}', [AssetController::class, 'destroy'])->middleware('permission:assets.delete');

    // Asset files (images & documents)
    Route::get('assets/{asset}/images', [AssetFileController::class, 'images'])->middleware('permission:assets.view');
    Route::get('assets/{asset}/documents', [AssetFileController::class, 'documents'])->middleware('permission:assets.view');
    Route::post('assets/{asset}/images', [AssetFileController::class, 'uploadImage'])->middleware('permission:assets.update');
    Route::post('assets/{asset}/documents', [AssetFileController::class, 'uploadDocument'])->middleware('permission:assets.update');
    Route::get('files/{type}/{id}/download', [AssetFileController::class, 'download'])->whereIn('type', ['image', 'document'])->middleware('permission:assets.view');
    Route::delete('asset-images/{image}', [AssetFileController::class, 'destroyImage'])->middleware('permission:assets.update');
    Route::delete('asset-documents/{document}', [AssetFileController::class, 'destroyDocument'])->middleware('permission:assets.update');

    // Assignments & returns
    Route::get('asset-assignments', [AssignmentController::class, 'index'])->middleware('permission:assets.view');
    Route::get('asset-assignments/{assignment}', [AssignmentController::class, 'show'])->middleware('permission:assets.view');
    Route::post('assets/{asset}/assign', [AssignmentController::class, 'assign'])->middleware('permission:assets.assign');
    Route::post('asset-assignments/{assignment}/return', [AssignmentController::class, 'returnAsset'])->middleware('permission:assets.return');

    // Transfers
    Route::get('transfers', [TransferController::class, 'index'])->middleware('permission:assets.view');
    Route::get('transfers/{transfer}', [TransferController::class, 'show'])->middleware('permission:assets.view');
    Route::post('assets/{asset}/transfers', [TransferController::class, 'store'])->middleware('permission:assets.transfer');
    Route::patch('transfers/{transfer}/status', [TransferController::class, 'transition'])->middleware('permission:assets.transfer');

    // Asset requests
    Route::get('asset-requests', [AssetRequestController::class, 'index'])->middleware('permission:requests.view');
    Route::post('asset-requests', [AssetRequestController::class, 'store'])->middleware('permission:requests.create');
    Route::get('asset-requests/{assetRequest}', [AssetRequestController::class, 'show'])->middleware('permission:requests.view');
    Route::post('asset-requests/{assetRequest}/submit', [AssetRequestController::class, 'submit'])->middleware('permission:requests.create');
    Route::post('asset-requests/{assetRequest}/department-approve', [AssetRequestController::class, 'departmentApprove'])->middleware('permission:requests.approve');
    Route::post('asset-requests/{assetRequest}/manager-approve', [AssetRequestController::class, 'managerApprove'])->middleware('permission:requests.approve');
    Route::post('asset-requests/{assetRequest}/complete', [AssetRequestController::class, 'complete'])->middleware('permission:requests.approve');
});
