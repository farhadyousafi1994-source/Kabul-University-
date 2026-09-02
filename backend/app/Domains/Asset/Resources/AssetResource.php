<?php

namespace App\Domains\Asset\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssetResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'asset_code' => $this->asset_code,
            'name' => $this->name,
            'description' => $this->description,
            'category_id' => $this->category_id,
            'category' => $this->whenLoaded('category', fn () => [
                'id' => $this->category->id,
                'name' => $this->category->name,
                'code' => $this->category->code,
            ]),
            'subcategory_id' => $this->subcategory_id,
            'subcategory' => $this->whenLoaded('subcategory', fn () => [
                'id' => $this->subcategory->id,
                'name' => $this->subcategory->name,
            ]),
            'brand' => $this->brand,
            'model' => $this->model,
            'serial_number' => $this->serial_number,
            'barcode' => $this->barcode,
            'qr_code' => $this->qr_code,
            'purchase_date' => $this->purchase_date?->toDateString(),
            'purchase_price' => (float) $this->purchase_price,
            'current_value' => (float) $this->current_value,
            'salvage_value' => (float) $this->salvage_value,
            'supplier_id' => $this->supplier_id,
            'supplier' => $this->whenLoaded('supplier', fn () => [
                'id' => $this->supplier->id,
                'name' => $this->supplier->name,
            ]),
            'warranty_expiry_date' => $this->warranty_expiry_date?->toDateString(),
            'useful_life' => $this->useful_life,
            'status' => $this->status,
            'condition' => $this->condition,
            // Location
            'campus_id' => $this->campus_id,
            'faculty_id' => $this->faculty_id,
            'department_id' => $this->department_id,
            'building_id' => $this->building_id,
            'floor_id' => $this->floor_id,
            'room_id' => $this->room_id,
            // Direct employee assignment
            'employee_id' => $this->employee_id,
            'employee_name' => $this->whenLoaded('employee', fn () => $this->employee?->full_name),
            'employee_code' => $this->whenLoaded('employee', fn () => $this->employee?->employee_code),
            'location' => $this->whenLoaded('campus', function () {
                $parts = array_filter([
                    $this->room?->name,
                    $this->floor?->name,
                    $this->building?->name,
                    $this->department?->name,
                    $this->faculty?->name,
                    $this->campus?->name,
                ]);

                return implode(' / ', $parts);
            }),
            'images_count' => $this->whenCounted('images'),
            'documents_count' => $this->whenCounted('documents'),
            'created_by' => $this->created_by,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
