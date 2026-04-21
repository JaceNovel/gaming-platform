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
            Schema::create('push_subscriptions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                $table->text('endpoint');
                $table->string('endpoint_hash', 64);
                $table->string('public_key', 255);
                $table->string('auth_token', 255);
                $table->string('content_encoding', 30)->default('aesgcm');
                $table->timestamp('last_used_at')->nullable();
                $table->timestamps();

                $table->unique('endpoint_hash');
                $table->index(['user_id', 'created_at']);
            });

            return;
        }

        if (!Schema::hasColumn('push_subscriptions', 'endpoint_hash')) {
            Schema::table('push_subscriptions', function (Blueprint $table) {
                $table->string('endpoint_hash', 64)->nullable()->after('endpoint');
            });
        }

        DB::table('push_subscriptions')
            ->select(['id', 'endpoint'])
            ->whereNull('endpoint_hash')
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

        if (!$this->indexExists('push_subscriptions', 'push_subscriptions_endpoint_hash_unique')) {
            Schema::table('push_subscriptions', function (Blueprint $table) {
                $table->unique('endpoint_hash');
            });
        }

        if (!$this->indexExists('push_subscriptions', 'push_subscriptions_user_id_created_at_index')) {
            Schema::table('push_subscriptions', function (Blueprint $table) {
                $table->index(['user_id', 'created_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
    }

    private function indexExists(string $table, string $indexName): bool
    {
        $driver = Schema::getConnection()->getDriverName();

        return match ($driver) {
            'mysql' => DB::table('information_schema.statistics')
                ->where('table_schema', DB::getDatabaseName())
                ->where('table_name', $table)
                ->where('index_name', $indexName)
                ->exists(),
            'pgsql' => DB::table('pg_indexes')
                ->where('schemaname', 'public')
                ->where('tablename', $table)
                ->where('indexname', $indexName)
                ->exists(),
            default => false,
        };
    }
};
