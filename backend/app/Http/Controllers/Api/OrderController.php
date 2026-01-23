<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\OrderItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    public function index(Request $request)
    {
        $orders = $request->user()->orders()->with(['orderItems.product', 'payment'])->latest()->paginate(20);
        return response()->json($orders);
    }

    public function show(Request $request, Order $order)
    {
        if ($order->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $order->load(['orderItems.product', 'payment']);
        return response()->json($order);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'nullable|integer|min:1',
            'items.*.qty' => 'nullable|integer|min:1',
            'items.*.game_id' => 'nullable|string|max:255',
        ]);

        $user = $request->user();
        $totalAmount = 0;
        $validatedItems = [];

        foreach ($data['items'] as $item) {
            $quantity = $item['quantity'] ?? $item['qty'] ?? null;

            if (!$quantity) {
                throw ValidationException::withMessages([
                    'items' => 'Quantity is required for each item',
                ]);
            }

            $product = Product::findOrFail($item['product_id']);

            if (!$product->is_active) {
                throw ValidationException::withMessages([
                    'items' => "Product {$product->name} is not available",
                ]);
            }

            if ($product->type === 'account' && $product->stock < $quantity) {
                throw ValidationException::withMessages([
                    'items' => "Product {$product->name} is out of stock",
                ]);
            }

            $unitPrice = $product->discount_price ?? $product->price;
            $lineTotal = $unitPrice * $quantity;
            $totalAmount += $lineTotal;

            $validatedItems[] = [
                'product_id' => $product->id,
                'quantity' => $quantity,
                'price' => $unitPrice,
                'game_id' => $item['game_id'] ?? null,
                'type' => $product->type,
            ];
        }

        $order = DB::transaction(function () use ($user, $validatedItems, $totalAmount) {
            $order = Order::create([
                'user_id' => $user->id,
                'type' => 'purchase',
                'total_price' => $totalAmount,
                'status' => 'pending',
                'items' => $validatedItems,
                'reference' => 'ORD-' . strtoupper(uniqid()),
            ]);

            foreach ($validatedItems as $item) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'price' => $item['price'],
                    'game_user_id' => $item['game_id'],
                    'delivery_status' => 'pending',
                ]);
            }

            return $order;
        });

        return response()->json([
            'order' => $order->load('orderItems.product'),
            'message' => 'Order created successfully'
        ], 201);
    }
}