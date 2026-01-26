<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Like;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminOfferController extends Controller
{
    public function boostLikes(Request $request)
    {
        $data = $request->validate([
            'product_id' => 'required|exists:products,id',
            'min' => 'nullable|integer|min:1',
            'max' => 'nullable|integer|min:1',
            'count' => 'nullable|integer|min:1',
        ]);

        $min = (int) ($data['min'] ?? 0);
        $max = (int) ($data['max'] ?? 0);
        $count = (int) ($data['count'] ?? 0);

        if ($count <= 0) {
            if ($max > 0) {
                $count = random_int($min > 0 ? $min : 1, max($min, $max));
            } else {
                $count = $min;
            }
        }

        if ($count <= 0) {
            return response()->json(['message' => 'Invalid like count'], 422);
        }

        $product = Product::findOrFail($data['product_id']);

        $existingUserIds = Like::where('product_id', $product->id)->pluck('user_id')->all();
        $selectedUserIds = User::whereNotIn('id', $existingUserIds)
            ->inRandomOrder()
            ->limit($count)
            ->pluck('id')
            ->all();

        $remaining = $count - count($selectedUserIds);
        $botIds = [];

        DB::transaction(function () use ($remaining, &$botIds) {
            if ($remaining <= 0) {
                return;
            }

            for ($i = 0; $i < $remaining; $i++) {
                $bot = User::create([
                    'name' => 'Like Bot ' . Str::upper(Str::random(4)),
                    'email' => 'likebot+' . Str::uuid() . '@badboyshop.local',
                    'password' => Hash::make(Str::random(16)),
                    'role' => 'bot',
                ]);
                $botIds[] = $bot->id;
            }
        });

        $userIds = array_merge($selectedUserIds, $botIds);
        $timestamp = now();
        $rows = array_map(fn ($userId) => [
            'user_id' => $userId,
            'product_id' => $product->id,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ], $userIds);

        if ($rows) {
            Like::insert($rows);
        }

        $totalLikes = Like::where('product_id', $product->id)->count();

        return response()->json([
            'message' => 'Likes added',
            'data' => [
                'product_id' => $product->id,
                'added' => count($rows),
                'total_likes' => $totalLikes,
            ],
        ]);
    }
}
