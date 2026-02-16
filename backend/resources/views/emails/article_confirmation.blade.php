@component('emails.layout', ['title' => 'Commande confirmée', 'logo' => ($logo ?? null)])
  <h2 style="margin:0 0 10px 0; color:#00ff99;">Commande confirmée ✅</h2>

  <p>Bonjour {{ $order->user->name ?? 'client' }},</p>
  <p>Votre paiement a été confirmé. Nous préparons votre commande.</p>

  <div class="highlight">
      <h3 style="margin:0 0 10px 0;">Détails</h3>
      <p style="margin:6px 0;"><strong>Article :</strong> {{ $orderItem->product->name ?? $article->name ?? 'Article' }}</p>
      <p style="margin:6px 0;"><strong>Montant :</strong> {{ number_format($order->total_price ?? $order->total_amount ?? 0, 0, ',', ' ') }} FCFA</p>
      <p style="margin:6px 0;"><strong>Référence :</strong> {{ $order->reference }}</p>
      <p style="margin:6px 0;"><strong>Date :</strong> {{ optional($order->created_at)->format('d/m/Y H:i') }}</p>
  </div>

  <p>Vous recevrez un email dès que la livraison sera prête.</p>
@endcomponent