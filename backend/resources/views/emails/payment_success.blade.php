@component('emails.layout', ['title' => 'Paiement réussi', 'logo' => ($logo ?? null)])
  <h2 style="margin:0 0 10px 0; color:#00ff99;">Paiement confirmé ✅</h2>

  <p style="margin:0 0 10px 0; color:#ffffff;">Bonjour {{ $order->user->name ?? 'Client' }},</p>
  <p style="margin:0 0 10px 0; color:#ffffff;">Votre paiement de <strong>{{ number_format($order->total_amount ?? 0, 0, ',', ' ') }} FCFA</strong> a été traité avec succès.</p>

    <div class="highlight" style="background-color:#333333;padding:15px;border-left:4px solid #ff0000;margin:20px 0;color:#ffffff;">
      <h3 style="margin:0 0 10px 0;color:#ffffff;">Détails commande #{{ $order->id }}</h3>
      <p style="margin:6px 0;color:#ffffff;"><strong>Total :</strong> {{ number_format($order->total_amount ?? 0, 0, ',', ' ') }} FCFA</p>
    </div>

  <p style="margin:0; color:#ffffff;">Vous recevrez un email dès que la livraison sera prête.</p>
@endcomponent