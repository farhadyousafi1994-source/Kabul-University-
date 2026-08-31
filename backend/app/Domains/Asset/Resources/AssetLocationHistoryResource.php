<?php

namespace App\Domains\Asset\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssetLocationHistoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'asset_id' => $this->asset_id,
            'campus_id' => $this->campus_id,
            'faculty_id' => $this->faculty_id,
            'department_id' => $this->department_id,
            'building_id' => $this->building_id,
            'floor_id' => $this->floor_id,
            'room_id' => $this->room_id,
            'moved_by' => $this->moved_by,
            'moved_at' => $this->moved_at,
            'reason' => $this->reason,
        ];
    }
}
