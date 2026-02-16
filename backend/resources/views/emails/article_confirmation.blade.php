@component('emails.layout', ['title' => 'Commande confirmée', 'logo' => ($logo ?? null)])
  <h2 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:18px;line-height:22px;color:#111111;">Commande confirmée</h2>

  <p>Bonjour {{ $order->user->name ?? 'client' }},</p>
  <p>Votre paiement a été confirmé. Nous préparons votre commande.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0;border:1px solid #e5e5e5;background-color:#f7f7f7;">
      <tr>
        <td style="padding:12px;font-family:Arial, sans-serif;font-size:14px;line-height:20px;color:#111111;">
          <h3 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:16px;line-height:20px;color:#111111;">Détails</h3>
          <p style="margin:6px 0;"><strong>Article :</strong> {{ $orderItem->product->name ?? $article->name ?? 'Article' }}</p>
          <p style="margin:6px 0;"><strong>Montant :</strong> {{ number_format($order->total_price ?? $order->total_amount ?? 0, 0, ',', ' ') }} FCFA</p>
          <p style="margin:6px 0;"><strong>Référence :</strong> {{ $order->reference }}</p>
          <p style="margin:6px 0;"><strong>Date :</strong> {{ optional($order->created_at)->format('d/m/Y H:i') }}</p>
        </td>
      </tr>
    </table>

  <p>Vous recevrez un email dès que la livraison sera prête.</p>
@endcomponent