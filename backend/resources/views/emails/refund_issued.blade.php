@extends('emails.layout', ['title' => 'Remboursement'])

@section('slot')
<h2 style="color:#00ff00;">Remboursement effectué</h2>

<p>Bonjour {{ $order->user?->name ?? 'Client' }},</p>

<p>
Nous sommes désolés : un article de votre commande
<strong>{{ $order->reference ?? $order->id }}</strong>
était indisponible au moment de la livraison.
</p>

<div class="highlight">
    <p><strong>Montant remboursé :</strong> {{ number_format((float) $refund->amount, 0, ',', ' ') }} FCFA</p>
    <p><strong>Statut :</strong> crédité sur votre wallet</p>
    @if(!empty($refund->reason))
        <p><strong>Raison :</strong> {{ $refund->reason }}</p>
    @endif
</div>

<p>
Le montant a été automatiquement ajouté à votre wallet BADBOYSHOP. Vous pouvez l'utiliser pour un prochain achat.
</p>

<p>Merci pour votre compréhension.</p>
@endsection
