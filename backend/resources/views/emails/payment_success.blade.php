@component('emails.layout', ['title' => 'Paiement réussi', 'logo' => ($logo ?? null)])
  <h2 style="margin:0 0 10px 0; color:#00ff99;">Paiement confirmé ✅</h2>

  <p>Bonjour {{ $order->user->name ?? 'Client' }},</p>
  <p>Votre paiement de <strong>{{ number_format($order->total_amount ?? 0, 0, ',', ' ') }} FCFA</strong> a été traité avec succès.</p>

  <div class="highlight">
      <h3 style="margin:0 0 10px 0;">Détails commande #{{ $order->id }}</h3>
      <p style="margin:6px 0;"><strong>Total :</strong> {{ number_format($order->total_amount ?? 0, 0, ',', ' ') }} FCFA</p>
  </div>

  <p>Vous recevrez un email dès que la livraison sera prête.</p>
@endcomponent