<?php

namespace App\Domains\System\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    public const TYPE_STRING = 'string';
    public const TYPE_NUMBER = 'number';
    public const TYPE_BOOLEAN = 'boolean';
    public const TYPE_JSON = 'json';

    protected $fillable = ['key', 'value', 'group', 'type'];

    public const DEFAULTS = [
        // University information
        'university_name' => ['Kabul University', 'university', self::TYPE_STRING],
        'university_logo' => [null, 'university', self::TYPE_STRING],
        'university_address' => ['Jamal Mena, District 3, Kabul, Afghanistan', 'university', self::TYPE_STRING],
        'university_phone' => ['+93 20 220 0555', 'university', self::TYPE_STRING],
        'university_email' => ['info@ku.edu.af', 'university', self::TYPE_STRING],
        // System
        'default_currency' => ['AFN', 'system', self::TYPE_STRING],
        'date_format' => ['Y-m-d', 'system', self::TYPE_STRING],
        'pagination' => ['20', 'system', self::TYPE_NUMBER],
        'asset_code_format' => ['KU-{CATEGORY}-{YEAR}-{NUMBER}', 'asset', self::TYPE_STRING],
        // Asset
        'default_useful_life' => ['5', 'asset', self::TYPE_NUMBER],
        'depreciation_method' => ['SL', 'asset', self::TYPE_STRING],
    ];
}
