<?php

namespace App\Domains\Asset\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssetTransferResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'asset_id' => $this->asset_id,
            'from_campus_id' => $this->from_campus_id,
            'from_faculty_id' => $this->from_faculty_id,
            'from_department_id' => $this->from_department_id,
            'from_building_id' => $this->from_building_id,
            'from_floor_id' => $this->from_floor_id,
            'from_room_id' => $this->from_room_id,
            'to_campus_id' => $this->to_campus_id,
            'to_faculty_id' => $this->to_faculty_id,
            'to_department_id' => $this->to_department_id,
            'to_building_id' => $this->to_building_id,
            'to_floor_id' => $this->to_floor_id,
            'to_room_id' => $this->to_room_id,
            'requested_by' => $this->requested_by,
            'approved_by' => $this->approved_by,
            'transfer_date' => $this->transfer_date,
            'status' => $this->status,
            'notes' => $this->notes,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
