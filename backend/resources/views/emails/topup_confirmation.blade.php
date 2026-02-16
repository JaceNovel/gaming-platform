@component('emails.layout', ['title' => 'Confirmation de recharge', 'logo' => ($logo ?? null)])
  <h2 style="margin:0 0 10px 0; color:#00ff99;">Recharge confirmée ✅</h2>

  <p>Bonjour {{ $order->user->name ?? 'client' }},</p>
  <p>Votre paiement est confirmé et votre compte a été rechargé.</p>

  <div class="highlight">
      <h3 style="margin:0 0 10px 0;">Détails</h3>
      <p style="margin:6px 0;"><strong>Montant :</strong> {{ number_format($order->total_price ?? $order->total_amount ?? 0, 0, ',', ' ') }} FCFA</p>
      <p style="margin:6px 0;"><strong>Compte :</strong> {{ $topupDetails['account_number'] ?? $orderItem->game_user_id ?? 'N/A' }}</p>
      <p style="margin:6px 0;"><strong>Opérateur :</strong> {{ $topupDetails['operator'] ?? 'Mobile Money' }}</p>
      <p style="margin:6px 0;"><strong>Date :</strong> {{ optional($order->created_at)->format('d/m/Y H:i') }}</p>
  </div>

  <p>La recharge devrait apparaître dans les prochaines minutes.</p>
  <p style="color:#cccccc; font-size:13px;">Si ce n’est pas le cas après 1h, contactez-nous (WhatsApp en bas de page).</p>
@endcomponent