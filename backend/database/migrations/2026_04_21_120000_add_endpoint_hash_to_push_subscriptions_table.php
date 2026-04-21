<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('push_subscriptions')) {
            return;
        }

        if (!Schema::hasColumn('push_subscriptions', 'endpoint_hash')) {
            Schema::table('push_subscriptions', function (Blueprint $table) {
                $table->string('endpoint_hash', 64)->nullable()->after('endpoint');
            });
        }

        DB::table('push_subscriptions')
            ->select(['id', 'endpoint'])
            ->orderBy('id')
            ->chunkById(100, function ($rows): void {
                foreach ($rows as $row) {
                    DB::table('push_subscriptions')
                        ->where('id', $row->id)
                        ->update([
                            'endpoint_hash' => hash('sha256', (string) $row->endpoint),
                        ]);
                }
            });

        Schema::table('push_subscriptions', function (Blueprint $table) {
            $table->unique('endpoint_hash');
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('push_subscriptions') || !Schema::hasColumn('push_subscriptions', 'endpoint_hash')) {
            return;
        }

        Schema::table('push_subscriptions', function (Blueprint $table) {
            $table->dropUnique(['endpoint_hash']);
            $table->dropColumn('endpoint_hash');
        });
    }
};