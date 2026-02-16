@component('emails.layout', ['title' => 'Paiement réussi', 'logo' => ($logo ?? null)])
  <h2 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:18px;line-height:22px;color:#111111;">Paiement confirmé</h2>

  <p>Bonjour {{ $order->user->name ?? 'Client' }},</p>
  <p>Votre paiement de <strong>{{ number_format($order->total_amount ?? 0, 0, ',', ' ') }} FCFA</strong> a été traité avec succès.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0;border:1px solid #e5e5e5;background-color:#f7f7f7;">
      <tr>
        <td style="padding:12px;font-family:Arial, sans-serif;font-size:14px;line-height:20px;color:#111111;">
          <h3 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:16px;line-height:20px;color:#111111;">Détails commande #{{ $order->id }}</h3>
          <p style="margin:6px 0;"><strong>Total :</strong> {{ number_format($order->total_amount ?? 0, 0, ',', ' ') }} FCFA</p>
        </td>
      </tr>
    </table>

  <p>Vous recevrez un email dès que la livraison sera prête.</p>
@endcomponent