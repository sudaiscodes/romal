<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class LedgerEntry extends Model
{
    use SoftDeletes;

    protected $guarded = [];
    protected $casts = ['date' => 'date:Y-m-d'];

    public function party() { return $this->belongsTo(Party::class); }
    public function invoice() { return $this->belongsTo(Invoice::class); }
}