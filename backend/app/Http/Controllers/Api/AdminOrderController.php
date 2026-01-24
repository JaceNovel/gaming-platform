<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;
use Dompdf\Dompdf;
use Dompdf\Options;

class AdminOrderController extends Controller
{
    public function updateStatus(Request $request, Order $order)
    {
        $data = $request->validate([
            'status' => 'required|string|max:32',
        ]);

        $order->status = strtoupper($data['status']);
        $order->save();

        return response()->json(['order' => $order]);
    }

    public function deliveryNotePdf(Order $order)
    {
        $order->load(['user', 'orderItems.product']);

        $html = view('delivery-note', ['order' => $order])->render();

        $options = new Options();
        $options->set('isRemoteEnabled', true);
        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4');
        $dompdf->render();

        return response($dompdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="delivery-note-'.$order->id.'.pdf"',
        ]);
    }
}
