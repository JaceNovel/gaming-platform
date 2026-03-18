<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Shipping Mark {{ $order->reference }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #f8fafc; }
        .sheet { border: 3px solid #111827; background: #fff; border-radius: 18px; padding: 24px; }
        .brand { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; }
        .brand h1 { margin: 0; font-size: 28px; letter-spacing: 1px; }
        .badge { display: inline-block; padding: 6px 12px; border-radius: 999px; background: #111827; color: #fff; font-size: 11px; text-transform: uppercase; }
        .grid, .items { width: 100%; border-collapse: collapse; margin-top: 18px; }
        .grid td, .items th, .items td { border: 1px solid #cbd5e1; padding: 10px; }
        .grid td { width: 50%; vertical-align: top; padding: 12px; }
        .items th { background: #f1f5f9; text-transform: uppercase; font-size: 10px; letter-spacing: 0.06em; }
        .label { font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
        .value { font-size: 15px; font-weight: bold; }
        .note { margin-top: 18px; padding: 16px; border-radius: 14px; background: #eff6ff; border: 1px solid #bfdbfe; font-size: 13px; line-height: 1.5; }
        .footer { margin-top: 18px; display: flex; justify-content: space-between; align-items: flex-end; }
        .footer small { color: #475569; display: block; line-height: 1.5; }
        .qr { text-align: right; }
        .qr img { width: 120px; height: 120px; border: 1px solid #cbd5e1; padding: 8px; background: #fff; }
    </style>
</head>
<body>
    <div class="sheet">
        <div class="brand">
            <div>
                <span class="badge">PRIMEGaming Shipping Mark</span>
                <h1>{{ $order->reference }}</h1>
                <div style="font-size: 13px; color: #475569; margin-top: 6px;">Commande AliExpress orientee vers le hub logistique France-Lome</div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 12px; color: #64748b;">Pays final</div>
                <div style="font-size: 26px; font-weight: bold;">{{ $snapshot['country_code'] ?? $order->supplier_country_code }}</div>
            </div>
        </div>

        <table class="grid">
            <tr>
                <td>
                    <div class="label">Hub logistique</div>
                    <div class="value">{{ $snapshot['transit_provider_name'] ?? 'Non configure' }}</div>
                    <div style="margin-top: 4px; font-size: 12px; color: #475569;">{{ $snapshot['transit_city'] ?? 'Maisons-Laffitte' }}</div>
                </td>
                <td>
                    <div class="label">Adresse de reception hub</div>
                    <div class="value">{{ $receivingAddress?->recipient_name ?? 'Adresse absente' }}</div>
                    <div style="margin-top: 4px; font-size: 12px; color: #475569;">
                        {{ $receivingAddress?->address_line1 }}<br>
                        @if($receivingAddress?->address_line2)
                            {{ $receivingAddress?->address_line2 }}<br>
                        @endif
                        {{ $receivingAddress?->city }} {{ $receivingAddress?->postal_code }}<br>
                        {{ $receivingAddress?->phone }}
                    </div>
                </td>
            </tr>
            <tr>
                <td>
                    <div class="label">Shipping mark</div>
                    <div class="value">{{ $receivingAddress?->shipping_mark ?? 'PRIMEGaming' }}</div>
                    <div style="margin-top: 4px; font-size: 12px; color: #475569;">{{ $receivingAddress?->notes ?? 'A coller sur chaque colis fournisseur.' }}</div>
                </td>
                <td>
                    <div class="label">Client final</div>
                    <div class="value">{{ $order->user?->name ?? 'Client PRIMEGaming' }}</div>
                    <div style="margin-top: 4px; font-size: 12px; color: #475569;">
                        {{ $order->shipping_phone ?? $order->user?->phone }}<br>
                        {{ $order->shipping_city ?? ($order->meta['customer_city'] ?? '') }}<br>
                        {{ $snapshot['country_name'] ?? ($order->supplier_country_code ?? '') }}
                    </div>
                </td>
            </tr>
        </table>

        <table class="items">
            <thead>
                <tr>
                    <th>Produit</th>
                    <th>Quantite</th>
                    <th>Poids estime</th>
                    <th>Groupage</th>
                </tr>
            </thead>
            <tbody>
                @foreach($items as $item)
                    <tr>
                        <td>{{ $item->product?->name ?? 'Produit' }}</td>
                        <td>{{ $item->quantity }}</td>
                        <td>{{ $item->product?->estimated_weight_grams ? number_format($item->product->estimated_weight_grams / 1000, 2, ',', ' ') . ' kg' : 'N/A' }}</td>
                        <td>{{ $item->product?->grouping_threshold ?? 1 }} unites</td>
                    </tr>
                @endforeach
            </tbody>
        </table>

        <div class="note">
            {{ $snapshot['customer_notice'] ?? 'Le colis doit etre livre a notre hub logistique principal en France. Ne jamais expedier directement chez le client final.' }}
        </div>

        <div class="footer">
            <div>
                <small>PRIMEGaming</small>
                <small>Founder: AMAH-TCHOUTCHOUI LEMOUEL JONADAB</small>
                <small>Pseudo: Jacen</small>
                <small>Support: +33688639294</small>
                <small>Mode operatoire: reception hub France-Lome, preparation logistique, expedition locale Afrique.</small>
            </div>
            <div class="qr">
                <img src="{{ $qrCodeUrl }}" alt="QR Code">
                <small>Scan interne logistique</small>
            </div>
        </div>
    </div>
</body>
</html>