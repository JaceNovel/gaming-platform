<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrderItem;
use App\Models\Review;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'product_id' => 'required|exists:products,id',
        ]);

        $reviews = Review::with('user')
            ->where('product_id', $request->input('product_id'))
            ->latest()
            ->paginate(10);

        return response()->json($reviews);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'product_id' => 'required|exists:products,id',
            'rating' => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string|max:2000',
        ]);

        $user = $request->user();

        $delivered = OrderItem::where('product_id', $data['product_id'])
            ->whereHas('order', function ($q) use ($user) {
                $q->where('user_id', $user->id)
                  ->whereIn('status', ['LIVRE', 'LIVRÉ', 'DELIVERED', 'delivered', 'livre']);
            })
            ->exists();

        if (!$delivered) {
            return response()->json(['message' => 'Order not delivered'], 403);
        }

        $review = Review::updateOrCreate(
            ['product_id' => $data['product_id'], 'user_id' => $user->id],
            ['rating' => $data['rating'], 'comment' => $data['comment']]
        );

        $stats = Review::where('product_id', $data['product_id'])
            ->selectRaw('COUNT(*) as count, AVG(rating) as avg')
            ->first();

        $review->product()->update([
            'rating_count' => (int) ($stats->count ?? 0),
            'rating_avg' => (float) ($stats->avg ?? 0),
        ]);

        return response()->json($review, 201);
    }
}
