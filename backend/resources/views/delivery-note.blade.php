<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8" />
    <title>Bon de livraison</title>
    <style>
        body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 12px; color: #111; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .section { margin-bottom: 14px; }
        .label { font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
        .signature { margin-top: 30px; display: flex; justify-content: space-between; }
        .signature div { width: 45%; border-top: 1px solid #444; padding-top: 6px; }
    </style>
</head>
<body>
    <h1>Bon de livraison BADBOYSHOP</h1>
    <div class="section">
        <div><span class="label">Commande:</span> #{{ $order->id }}</div>
        <div><span class="label">Référence:</span> {{ $order->reference }}</div>
        <div><span class="label">Date:</span> {{ $order->created_at }}</div>
    </div>

    <div class="section">
        <div><span class="label">Client:</span> {{ $order->user->name ?? '—' }}</div>
        <div><span class="label">Email:</span> {{ $order->user->email ?? '—' }}</div>
    </div>

    <div class="section">
        <table>
            <thead>
                <tr>
                    <th>Article</th>
                    <th>Quantité</th>
                    <th>Prix</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($order->orderItems as $item)
                    <tr>
                        <td>{{ $item->product->name ?? 'Produit' }}</td>
                        <td>{{ $item->quantity }}</td>
                        <td>{{ $item->price }} FCFA</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <div class="section">
        <div><span class="label">Total:</span> {{ $order->total_price }} FCFA</div>
    </div>

    <div class="signature">
        <div>Signature client</div>
        <div>Signature BADBOYSHOP</div>
    </div>
</body>
</html>
