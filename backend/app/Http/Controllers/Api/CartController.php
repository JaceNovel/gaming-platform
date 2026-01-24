<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CartItem;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function index(Request $request)
    {
        $items = CartItem::with('product')
            ->where('user_id', $request->user()->id)
            ->latest()
            ->get();

        return response()->json(['data' => $items]);
    }

    public function add(Request $request)
    {
        $data = $request->validate([
            'product_id' => 'required|exists:products,id',
            'quantity' => 'nullable|integer|min:1',
        ]);

        $item = CartItem::updateOrCreate(
            ['user_id' => $request->user()->id, 'product_id' => $data['product_id']],
            ['quantity' => $data['quantity'] ?? 1]
        );

        $item->product()->increment('cart_adds_count');

        return response()->json(['data' => $item]);
    }
}
