@component('emails.layout', ['title' => 'Livraison du compte', 'logo' => ($logo ?? null)])
  <h2 style="margin:0 0 10px 0; color:#00ff99;">Commande livrée ✅</h2>

  <p>Bonjour {{ $order->user->name ?? 'Client' }},</p>
  <p>Votre paiement est confirmé. Voici vos identifiants :</p>

  <div class="highlight">
      <h3 style="margin:0 0 10px 0;">{{ $game->name ?? 'Compte' }}</h3>
      @foreach($account_details as $key => $value)
          <p style="margin:6px 0;"><strong>{{ ucfirst($key) }} :</strong> {{ $value }}</p>
      @endforeach
  </div>

  <p style="color:#cccccc; font-size:13px;"><strong>Important :</strong> gardez ces informations en sécurité.</p>
@endcomponent