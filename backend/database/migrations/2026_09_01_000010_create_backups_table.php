<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Module 29 — Backup & disaster recovery index.
 *
 * One row per backup file kept on the server: either a real copy of the
 * SQLite database file or a portable JSON dump (used on MySQL/PostgreSQL).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('backups', function (Blueprint $table) {
            $table->id();
            $table->string('filename');
            $table->string('disk', 32)->default('local');
            $table->string('path');
            $table->string('driver', 32)->default('sqlite'); // sqlite|mysql|pgsql
            $table->string('format', 16)->default('sqlite'); // sqlite|json
            $table->string('kind', 24)->default('manual')->index(); // manual|scheduled|pre_restore
            $table->unsignedBigInteger('size')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->cascadeOnUpdate()->nullOnDelete();
            $table->timestamps();

            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backups');
    }
};
