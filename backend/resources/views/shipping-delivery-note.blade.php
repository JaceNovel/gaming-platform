<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8" />
    <title>Bon de livraison</title>
    <style>
        body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 12px; color: #111; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .header { display: flex; justify-content: space-between; align-items: center; }
        .logo { height: 40px; }
        .section { margin-bottom: 14px; }
        .label { font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
        .signature { margin-top: 30px; display: flex; justify-content: space-between; gap: 16px; }
        .signature div { width: 48%; border-top: 1px solid #444; padding-top: 6px; }
        .muted { color: #666; font-size: 11px; }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>BADBOYSHOP</h1>
            <div class="muted">BON DE LIVRAISON</div>
        </div>
        @if(!empty($logo_url))
            <img src="{{ $logo_url }}" alt="BADBOYSHOP" class="logo" />
        @endif
    </div>

    <div class="section">
        <div><span class="label">Commande:</span> #{{ $order->id }}</div>
        <div><span class="label">Référence:</span> {{ $order->reference }}</div>
        <div><span class="label">Date de génération:</span> {{ now()->toDateTimeString() }}</div>
    </div>

    <div class="section">
        <div><span class="label">Client:</span> {{ $order->user->name ?? '—' }}</div>
        <div><span class="label">Email:</span> {{ $order->user->email ?? '—' }}</div>
        <div><span class="label">Téléphone:</span> {{ $order->shipping_phone ?? '—' }}</div>
        <div><span class="label">Pays:</span> {{ $order->shipping_country_code ?? $order->user->country_code ?? '—' }}</div>
        <div><span class="label">Ville:</span> {{ $order->shipping_city ?? '—' }}</div>
        <div><span class="label">Adresse:</span> {{ $order->shipping_address_line1 ?? '—' }}</div>
    </div>

    <div class="section">
        <table>
            <thead>
                <tr>
                    <th>Article</th>
                    <th>Quantité</th>
                    <th>SKU</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($items as $item)
                    <tr>
                        <td>{{ $item->product->name ?? 'Produit' }}</td>
                        <td>{{ $item->quantity }}</td>
                        <td>{{ $item->product->sku ?? '—' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    @php
        $deliveryType = $items->contains(fn ($item) => $item->delivery_type === 'preorder') ? 'preorder' : 'in_stock';
    @endphp

    <div class="section">
        <div><span class="label">Total colis:</span> {{ $items->count() }}</div>
        <div><span class="label">Total items:</span> {{ $items->sum('quantity') }}</div>
        @if($order->shipping_eta_days)
            <div><span class="label">Livraison estimée:</span> {{ $order->shipping_eta_days }} jours ({{ $deliveryType }})</div>
        @endif
    </div>

    <div class="signature">
        <div>
            Nom & signature du client
            <div class="muted">Reçu conforme + Date</div>
        </div>
        <div>
            Nom livreur / signature
        </div>
    </div>

    <div class="signature" style="margin-top: 20px;">
        <div>
            @if(!empty($signature_url))
                <img src="{{ $signature_url }}" alt="Signature BADBOYSHOP" style="height: 60px;" />
                <div class="muted">Signé BADBOYSHOP</div>
            @else
                BADBOYSHOP – Signature officielle
            @endif
        </div>
    </div>
</body>
</html>
