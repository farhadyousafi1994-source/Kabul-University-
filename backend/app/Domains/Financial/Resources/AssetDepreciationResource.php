<?php

namespace App\Domains\Financial\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssetDepreciationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'asset_id' => $this->asset_id,
            'method_id' => $this->method_id,
            'period' => $this->period,
            'original_value' => $this->original_value,
            'salvage_value' => $this->salvage_value,
            'useful_life' => $this->useful_life,
            'annual_depreciation' => $this->annual_depreciation,
            'accumulated_depreciation' => $this->accumulated_depreciation,
            'book_value' => $this->book_value,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
