<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Invoice extends Model
{
    use SoftDeletes;

    protected $guarded = [];
    protected $casts = ['date' => 'date:Y-m-d'];

    public function party() { return $this->belongsTo(Party::class); }
    public function items() { return $this->hasMany(InvoiceItem::class); }
    public function ledgerEntry() { return $this->hasOne(LedgerEntry::class); }
}