<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $rows = DB::table('users')
            ->select(['id', 'name'])
            ->orderBy('id')
            ->get();

        $seen = [];
        $reserved = [];

        foreach ($rows as $row) {
            $normalized = strtoupper(trim((string) $row->name));
            if ($normalized === '') {
                $normalized = 'USER' . $row->id;
            }

            $reserved[$normalized] = true;
        }

        foreach ($rows as $row) {
            $normalized = strtoupper(trim((string) $row->name));
            if ($normalized === '') {
                $normalized = 'USER' . $row->id;
            }

            if (!isset($seen[$normalized])) {
                $seen[$normalized] = true;
                $finalName = $normalized;
            } else {
                $finalName = $this->buildUniqueUsername($normalized, $reserved);
                $reserved[$finalName] = true;
            }

            if ($finalName !== (string) $row->name) {
                DB::table('users')->where('id', $row->id)->update(['name' => $finalName]);
            }
        }

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

    private function buildUniqueUsername(string $normalized, array $reserved): string
    {
        $base = $normalized !== '' ? $normalized : 'USER';

        for ($suffix = 2; $suffix < 100000; $suffix++) {
            $suffixText = (string) $suffix;
            $candidateBase = mb_substr($base, 0, max(1, 7 - strlen($suffixText)));
            $candidate = $candidateBase . $suffixText;

            if (!isset($reserved[$candidate])) {
                return $candidate;
            }
        }

        throw new RuntimeException('Unable to generate a unique username for ' . $normalized);
    }
};