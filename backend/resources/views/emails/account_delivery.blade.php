@component('emails.layout', ['title' => 'Livraison du compte', 'logo' => ($logo ?? null)])
  <h2 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:18px;line-height:22px;color:#111111;">Commande livrée</h2>

  <p>Bonjour {{ $order->user->name ?? 'Client' }},</p>
  <p>Votre paiement est confirmé. Voici vos identifiants :</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0;border:1px solid #e5e5e5;background-color:#f7f7f7;">
      <tr>
        <td style="padding:12px;font-family:Arial, sans-serif;font-size:14px;line-height:20px;color:#111111;">
          <h3 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:16px;line-height:20px;color:#111111;">{{ $game->name ?? 'Compte' }}</h3>
          @foreach($account_details as $key => $value)
            <p style="margin:6px 0;"><strong>{{ ucfirst($key) }} :</strong> {{ $value }}</p>
          @endforeach
        </td>
      </tr>
    </table>

  <p style="font-size:13px;line-height:18px;color:#666666;"><strong>Important :</strong> gardez ces informations en sécurité.</p>
@endcomponent