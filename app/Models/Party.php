<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Party extends Model
{
    use SoftDeletes;

    protected $guarded = [];

    public function invoices() { return $this->hasMany(Invoice::class); }
    public function entries() { return $this->hasMany(LedgerEntry::class); }

    public function balance(): int
    {
        return (int) $this->entries()->where('type', 'credit')->sum('amount')
             - (int) $this->entries()->where('type', 'debit')->sum('amount');
    }
}