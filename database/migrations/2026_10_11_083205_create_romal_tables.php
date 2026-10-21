<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('parties', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();
            $t->timestamps();
            $t->softDeletes();
        });

        Schema::create('varieties', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();
            $t->string('category')->default('Romal'); // Romal, Shawl, Lungi
            $t->timestamps();
            $t->softDeletes();
        });

        Schema::create('invoices', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('invoice_no')->unique();
            $t->date('date');
            $t->foreignId('party_id')->constrained();
            $t->string('shipping_no')->nullable();
            $t->unsignedBigInteger('total');
            $t->timestamps();
            $t->softDeletes();
        });

        Schema::create('invoice_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $t->foreignId('variety_id')->constrained();
            $t->unsignedInteger('qty');
            $t->string('unit', 10)->default('dz'); // dz, pcs, sets
            $t->unsignedBigInteger('price');
            $t->unsignedBigInteger('total');
        });

        Schema::create('ledger_entries', function (Blueprint $t) {
            $t->id();
            $t->foreignId('party_id')->constrained();
            $t->foreignId('invoice_id')->nullable()->constrained();
            $t->date('date');
            $t->enum('type', ['credit', 'debit']); // credit = goods sent, debit = payment received
            $t->string('method')->nullable();       // cash, online, cheque
            $t->string('note')->nullable();
            $t->unsignedBigInteger('amount');
            $t->timestamps();
            $t->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ledger_entries');
        Schema::dropIfExists('invoice_items');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('varieties');
        Schema::dropIfExists('parties');
    }
};
