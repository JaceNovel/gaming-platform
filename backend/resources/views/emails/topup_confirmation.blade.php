@component('emails.layout', ['title' => 'Confirmation de recharge', 'logo' => ($logo ?? null)])
  <h2 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:18px;line-height:22px;color:#111111;">Recharge confirmée</h2>

  <p>Bonjour {{ $order->user->name ?? 'client' }},</p>
  <p>Votre paiement est confirmé et votre compte a été rechargé.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0;border:1px solid #e5e5e5;background-color:#f7f7f7;">
      <tr>
        <td style="padding:12px;font-family:Arial, sans-serif;font-size:14px;line-height:20px;color:#111111;">
          <h3 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:16px;line-height:20px;color:#111111;">Détails</h3>
          <p style="margin:6px 0;"><strong>Montant :</strong> {{ number_format($order->total_price ?? $order->total_amount ?? 0, 0, ',', ' ') }} FCFA</p>
          <p style="margin:6px 0;"><strong>Compte :</strong> {{ $topupDetails['account_number'] ?? $orderItem->game_user_id ?? 'N/A' }}</p>
          <p style="margin:6px 0;"><strong>Opérateur :</strong> {{ $topupDetails['operator'] ?? 'Mobile Money' }}</p>
          <p style="margin:6px 0;"><strong>Date :</strong> {{ optional($order->created_at)->format('d/m/Y H:i') }}</p>
        </td>
      </tr>
    </table>

  <p>La recharge devrait apparaître dans les prochaines minutes.</p>
  <p style="font-size:13px;line-height:18px;color:#666666;">Si ce n’est pas le cas après 1h, contactez-nous (WhatsApp en bas de page).</p>
@endcomponent