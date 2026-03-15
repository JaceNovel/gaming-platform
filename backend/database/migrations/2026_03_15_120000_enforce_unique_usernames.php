<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->selectRaw('UPPER(TRIM(name)) as normalized_name, COUNT(*) as aggregate')
            ->groupByRaw('UPPER(TRIM(name))')
            ->havingRaw('COUNT(*) > 1')
            ->when(DB::getDriverName() === 'pgsql', fn ($query) => $query)
            ->get()
            ->whenNotEmpty(function ($duplicates) {
                $list = $duplicates->pluck('normalized_name')->filter()->implode(', ');
                throw new RuntimeException('Duplicate usernames must be resolved before enforcing uniqueness: ' . $list);
            });

        DB::table('users')->whereNotNull('name')->orderBy('id')->chunkById(200, function ($rows) {
            foreach ($rows as $row) {
                $normalized = strtoupper(trim((string) $row->name));
                if ($normalized !== (string) $row->name) {
                    DB::table('users')->where('id', $row->id)->update(['name' => $normalized]);
                }
            }
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unique('name', 'users_name_unique');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_name_unique');
        });
    }
};