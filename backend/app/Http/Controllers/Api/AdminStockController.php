<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockMovement;
use App\Services\StockService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminStockController extends Controller
{
    public function movements(Request $request)
    {
        $query = StockMovement::with(['product', 'denomination', 'admin'])->latest('id');

        if ($request->filled('product_id')) {
            $query->where('product_id', $request->query('product_id'));
        }

        if ($request->filled('denomination_id')) {
            $query->where('redeem_denomination_id', $request->query('denomination_id'));
        }

        $perPage = $request->integer('per_page', 30);

        return response()->json($query->paginate($perPage));
    }

    public function adjustProduct(Request $request, Product $product, StockService $stockService)
    {
        $data = $request->validate([
            'quantity' => 'required|integer',
            'reason' => 'required|string|max:64',
        ]);

        $movement = $stockService->adjustProductStock(
            $product,
            $data['quantity'],
            $data['reason'],
            $request->user(),
            ['source' => 'admin_adjust']
        );

        return response()->json([
            'data' => $movement->load(['product', 'admin']),
        ], 201);
    }

    public function export(Request $request)
    {
        $query = StockMovement::with(['product', 'denomination', 'admin'])->latest('id');

        if ($request->filled('product_id')) {
            $query->where('product_id', $request->query('product_id'));
        }

        if ($request->filled('denomination_id')) {
            $query->where('redeem_denomination_id', $request->query('denomination_id'));
        }

        $filename = 'stock-movements-' . now()->format('Ymd_His') . '.csv';

        return new StreamedResponse(function () use ($query) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'id',
                'product',
                'denomination',
                'quantity',
                'direction',
                'reason',
                'admin',
                'created_at',
            ]);

            $query->chunk(500, function ($rows) use ($handle) {
                foreach ($rows as $row) {
                    fputcsv($handle, [
                        $row->id,
                        $row->product?->name,
                        $row->denomination?->code,
                        $row->quantity,
                        $row->direction,
                        $row->reason,
                        $row->admin?->email,
                        optional($row->created_at)->toIso8601String(),
                    ]);
                }
            });

            fclose($handle);
        }, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }
}
