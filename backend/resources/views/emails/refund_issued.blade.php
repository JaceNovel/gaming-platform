@component('emails.layout', ['title' => 'Remboursement', 'logo' => ($logo ?? null)])
    <h2 style="margin:0 0 10px 0; color:#00ff99;">Remboursement effectué ✅</h2>

    <p>Bonjour {{ $order->user?->name ?? 'Client' }},</p>

    <p>
        Un article de votre commande <strong>{{ $order->reference ?? $order->id }}</strong> était indisponible.
        Le montant a été remboursé sur votre wallet.
    </p>

    <div class="highlight">
            <p style="margin:6px 0;"><strong>Montant remboursé :</strong> {{ number_format((float) ($refund->amount ?? 0), 0, ',', ' ') }} FCFA</p>
            <p style="margin:6px 0;"><strong>Statut :</strong> crédité sur votre wallet</p>
            @if(!empty($refund->reason))
                    <p style="margin:6px 0;"><strong>Raison :</strong> {{ $refund->reason }}</p>
            @endif
    </div>

    <p>Merci pour votre compréhension.</p>
@endcomponent
