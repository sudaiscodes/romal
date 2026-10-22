<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Invoice numbers only need to be unique among invoices that are not deleted, so
     * deleting the latest invoice frees its number for the next one. That is enforced
     * in ApiController::storeInvoice.
     */
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $t) {
            $t->dropUnique(['invoice_no']);
            $t->index('invoice_no');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $t) {
            $t->dropIndex(['invoice_no']);
            $t->unique('invoice_no');
        });
    }
};
