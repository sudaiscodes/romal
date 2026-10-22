<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActivityLog extends Model
{
    const UPDATED_AT = null;

    protected $guarded = [];

    protected $casts = ['before' => 'array', 'after' => 'array', 'created_at' => 'datetime'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
