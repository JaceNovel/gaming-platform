@component('emails.layout', ['title' => 'Paiement confirmé', 'logo' => ($logo ?? null)])
  @php
    $productName = trim((string) ($orderItem->product->name ?? ''));
    $normalizedProductName = strtolower($productName);
    $isBooyahPass = $normalizedProductName === 'booyah pass';

    $gameUserId = null;
    if (is_string($topupDetails)) {
      $gameUserId = trim($topupDetails);
    } elseif (is_array($topupDetails)) {
      $gameUserId = trim((string) ($topupDetails['account_number'] ?? $topupDetails['game_id'] ?? $topupDetails['id'] ?? ''));
    }
    if ($gameUserId === null || $gameUserId === '') {
      $gameUserId = trim((string) ($orderItem->game_user_id ?? ''));
    }
  @endphp

  <h2 style="margin:0 0 10px 0; color:#00ff99;">Paiement confirmé ✅</h2>

    <p style="margin:0 0 10px 0; color:#ffffff;">Bonjour {{ $order->user->name ?? 'client' }},</p>
    <p style="margin:0 0 10px 0; color:#ffffff;">Votre paiement est confirmé. Votre commande est en cours de traitement.</p>

    <div class="highlight" style="background-color:#333333;padding:15px;border-left:4px solid #ff0000;margin:20px 0;color:#ffffff;">
      <h3 style="margin:0 0 10px 0;color:#ffffff;">Détails</h3>
      <p style="margin:6px 0;color:#ffffff;"><strong>Référence :</strong> {{ $order->reference ?? $order->id }}</p>
      <p style="margin:6px 0;color:#ffffff;"><strong>Produit :</strong> {{ $productName !== '' ? $productName : '—' }}</p>
      <p style="margin:6px 0;color:#ffffff;"><strong>Montant :</strong> {{ number_format($order->total_price ?? $order->total_amount ?? 0, 0, ',', ' ') }} FCFA</p>
      <p style="margin:6px 0;color:#ffffff;"><strong>ID saisi :</strong> {{ $gameUserId !== '' ? $gameUserId : '—' }}</p>
      <p style="margin:6px 0;color:#ffffff;"><strong>Date :</strong> {{ optional($order->created_at)->format('d/m/Y H:i') }}</p>
    </div>

  @if($isBooyahPass)
    <div class="highlight" style="background-color:#333333;padding:15px;border-left:4px solid #ff0000;margin:14px 0 0 0;color:#ffffff;">
      <h3 style="margin:0 0 10px 0;color:#ffffff;">Important (BOOYAH PASS)</h3>
      <p style="margin:6px 0;color:#ffffff;">Vous devez ajouter en amis cet ID Free Fire : <strong>2272704178</strong>.</p>
      <p style="margin:6px 0;color:#ffffff;">Vous recevrez votre achat dans un délai de <strong>30 minutes</strong>.</p>
    </div>
  @endif

  <p style="color:#cccccc; font-size:13px;">Si vous avez un souci, contactez-nous (WhatsApp en bas de page).</p>
@endcomponent