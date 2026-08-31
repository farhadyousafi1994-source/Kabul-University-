<?php

namespace App\Domains\Financial\Models;

use Illuminate\Database\Eloquent\Model;

class DepreciationMethod extends Model
{
    public const CODE_STRAIGHT_LINE = 'SL';
    public const CODE_DECLINING_BALANCE = 'DB';
    public const CODE_UNITS_OF_PRODUCTION = 'UP';

    protected $fillable = ['code', 'name', 'formula', 'rate', 'settings'];

    protected $casts = ['settings' => 'array'];
}
