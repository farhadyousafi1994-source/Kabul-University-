<?php

namespace App\Domains\Asset\Services;

use App\Domains\Asset\Models\AssetRequest;
use App\Domains\System\Services\ActivityLogService;
use App\Domains\System\Services\NotificationService;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Module 10 — Asset request & approval workflow.
 *
 * Draft → Submitted → Department Approval → Manager Review → Approved/Rejected → Completed
 */
class AssetRequestService
{
    public static function create(array $data, ?int $requesterId = null): AssetRequest
    {
        $requesterId ??= auth('sanctum')->id();

        $request = AssetRequest::create([
            'request_number' => self::generateNumber(),
            'requester_id' => $requesterId,
            'department_id' => $data['department_id'] ?? null,
            'request_type' => $data['request_type'],
            'asset_category_id' => $data['asset_category_id'] ?? null,
            'quantity' => $data['quantity'] ?? 1,
            'reason' => $data['reason'] ?? null,
            'status' => AssetRequest::STATUS_DRAFT,
        ]);

        ActivityLogService::record('created', 'Requests', AssetRequest::class, $request->id, $request->request_number, null, $data, $requesterId);

        return $request;
    }

    /**
     * Submit a draft → the request enters the approval pipeline.
     */
    public static function submit(AssetRequest $request): AssetRequest
    {
        self::assertStatus($request, [AssetRequest::STATUS_DRAFT], 'Only draft requests can be submitted.');

        $request->update(['status' => AssetRequest::STATUS_DEPARTMENT_APPROVAL]);

        ActivityLogService::record('submitted', 'Requests', AssetRequest::class, $request->id, $request->request_number);

        return $request->fresh();
    }

    /**
     * Department head approval step.
     */
    public static function departmentApprove(AssetRequest $request, bool $approve): AssetRequest
    {
        self::assertStatus($request, [AssetRequest::STATUS_DEPARTMENT_APPROVAL], 'Request is not awaiting department approval.');

        $request->update([
            'status' => $approve ? AssetRequest::STATUS_MANAGER_REVIEW : AssetRequest::STATUS_REJECTED,
        ]);

        ActivityLogService::record($approve ? 'approved' : 'rejected', 'Requests', AssetRequest::class, $request->id, $request->request_number);

        return $request->fresh();
    }

    /**
     * Asset manager review step.
     */
    public static function managerApprove(AssetRequest $request, bool $approve): AssetRequest
    {
        self::assertStatus($request, [AssetRequest::STATUS_MANAGER_REVIEW, AssetRequest::STATUS_DEPARTMENT_APPROVAL], 'Request is not awaiting asset manager review.');

        $request->update(['status' => $approve ? AssetRequest::STATUS_APPROVED : AssetRequest::STATUS_REJECTED]);

        ActivityLogService::record($approve ? 'approved' : 'rejected', 'Requests', AssetRequest::class, $request->id, $request->request_number);

        if ($approve) {
            NotificationService::send(
                $request->requester_id,
                'request_approved',
                'Asset request approved',
                "Your asset request {$request->request_number} was approved.",
                'check_circle',
            );
        } else {
            NotificationService::send(
                $request->requester_id,
                'request_rejected',
                'Asset request rejected',
                "Your asset request {$request->request_number} was rejected.",
                'cancel',
            );
        }

        return $request->fresh();
    }

    public static function complete(AssetRequest $request): AssetRequest
    {
        self::assertStatus($request, [AssetRequest::STATUS_APPROVED], 'Only approved requests can be completed.');

        $request->update(['status' => AssetRequest::STATUS_COMPLETED]);

        ActivityLogService::record('completed', 'Requests', AssetRequest::class, $request->id, $request->request_number);

        return $request->fresh();
    }

    public static function generateNumber(): string
    {
        return 'ARQ-'.now()->format('Y').'-'.str_pad((string) (AssetRequest::withTrashed()->count() + 1), 4, '0', STR_PAD_LEFT);
    }

    protected static function assertStatus(AssetRequest $request, array $allowed, string $message): void
    {
        if (! in_array($request->status, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => [$message],
            ]);
        }
    }
}
