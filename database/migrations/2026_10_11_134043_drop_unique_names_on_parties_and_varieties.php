<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Names only need to be unique among records that are not deleted, so a deleted
     * party or variety does not block reusing its name. That is enforced in validation.
     */
    public function up(): void
    {
        Schema::table('parties', function (Blueprint $t) {
            $t->dropUnique(['name']);
            $t->index('name');
        });

        Schema::table('varieties', function (Blueprint $t) {
            $t->dropUnique(['name']);
            $t->index('name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('parties', function (Blueprint $t) {
            $t->dropIndex(['name']);
            $t->unique('name');
        });

        Schema::table('varieties', function (Blueprint $t) {
            $t->dropIndex(['name']);
            $t->unique('name');
        });
    }
};
