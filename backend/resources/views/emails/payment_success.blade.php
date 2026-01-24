@extends('emails.layout', ['title' => 'Paiement réussi'])

@section('slot')
<h2 style="color: #00ff00;">Paiement confirmé !</h2>

<p>Bonjour {{ $order->user->name }},</p>

<p>Votre paiement de <strong>{{ number_format($order->total_amount, 0, ',', ' ') }} FCFA</strong> a été traité avec succès.</p>

<div class="highlight">
    <h3>Détails de la commande #{{ $order->id }}</h3>
    <ul>
        @foreach($order->items as $item)
        <li>{{ $item->product->name }} - {{ $item->quantity }} x {{ number_format($item->price, 0, ',', ' ') }} FCFA</li>
        @endforeach
    </ul>
    <p><strong>Total : {{ number_format($order->total_amount, 0, ',', ' ') }} FCFA</strong></p>
</div>

<p>Votre commande sera livrée sous peu. Vous recevrez un email de confirmation de livraison.</p>

<p>Merci pour votre confiance !</p>
@endsection