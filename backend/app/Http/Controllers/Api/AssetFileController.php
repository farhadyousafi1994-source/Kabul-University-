<?php

namespace App\Http\Controllers\Api;

use App\Domains\Asset\Models\Asset;
use App\Domains\Asset\Models\AssetDocument;
use App\Domains\Asset\Models\AssetImage;
use App\Domains\System\Services\ActivityLogService;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Module 7 — Asset images & documents.
 */
class AssetFileController extends Controller
{
    public function images(Asset $asset): JsonResponse
    {
        return ApiResponse::success('Images retrieved successfully.', $asset->images()->latest()->get());
    }

    public function documents(Asset $asset): JsonResponse
    {
        return ApiResponse::success('Documents retrieved successfully.', $asset->documents()->latest()->get());
    }

    public function uploadImage(Request $request, Asset $asset): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'], // 5 MB
        ]);

        $file = $request->file('image');
        $path = $file->store('assets/'.$asset->id.'/images', 'public');

        $image = $asset->images()->create([
            'filename' => $file->getClientOriginalName(),
            'path' => $path,
            'mime' => $file->getMimeType(),
            'size' => $file->getSize(),
            'created_by' => auth('sanctum')->id(),
        ]);

        ActivityLogService::record('created', 'Assets', Asset::class, $asset->id, $asset->name, null, ['image' => $image->filename]);

        return ApiResponse::success('Image uploaded successfully.', $image, null, 201);
    }

    public function uploadDocument(Request $request, Asset $asset): JsonResponse
    {
        $request->validate([
            'document' => ['required', 'file', 'max:10240'], // 10 MB
            'kind' => ['sometimes', Rule::in(AssetDocument::KINDS)],
        ]);

        $file = $request->file('document');
        $path = $file->store('assets/'.$asset->id.'/documents', 'public');

        $document = $asset->documents()->create([
            'kind' => $request->input('kind', AssetDocument::KIND_OTHER),
            'filename' => $file->getClientOriginalName(),
            'path' => $path,
            'mime' => $file->getMimeType(),
            'size' => $file->getSize(),
            'created_by' => auth('sanctum')->id(),
        ]);

        ActivityLogService::record('created', 'Assets', Asset::class, $asset->id, $asset->name, null, ['document' => $document->filename]);

        return ApiResponse::success('Document uploaded successfully.', $document, null, 201);
    }

    public function download(Request $request, string $type, int $id): BinaryFileResponse|JsonResponse
    {
        $model = $type === 'image' ? AssetImage::find($id) : AssetDocument::find($id);

        if (! $model || ! Storage::disk('public')->exists($model->path)) {
            return ApiResponse::error('File not found.', 404);
        }

        return response()->download(Storage::disk('public')->path($model->path), $model->filename);
    }

    public function destroyImage(AssetImage $image): JsonResponse
    {
        Storage::disk('public')->delete($image->path);
        $image->delete();

        ActivityLogService::record('deleted', 'Assets', AssetImage::class, $image->id, $image->filename);

        return ApiResponse::success('Image deleted successfully.');
    }

    public function destroyDocument(AssetDocument $document): JsonResponse
    {
        Storage::disk('public')->delete($document->path);
        $document->delete();

        ActivityLogService::record('deleted', 'Assets', AssetDocument::class, $document->id, $document->filename);

        return ApiResponse::success('Document deleted successfully.');
    }
}
