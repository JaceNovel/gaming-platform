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

    @php
      $gameName = strtolower((string) ($game->name ?? ''));
      $isFreeFire = str_contains($gameName, 'free fire');
    @endphp

    @if($isFreeFire)
      <div class="highlight">
        <h3 style="margin:0 0 10px 0;">Guide de sécurisation Free Fire 🔐</h3>

        @if(!empty($free_fire_guide_url))
          <p style="margin:6px 0;">Télécharge le guide PDF pour sécuriser ton compte après réception :</p>
          <p style="margin: 14px 0 0 0;">
            <a class="button" href="{{ $free_fire_guide_url }}">Télécharger le guide (PDF)</a>
          </p>
        @else
          <p style="margin:6px 0;">Un guide de sécurisation est disponible (Free Fire). Connecte-toi sur le site pour le récupérer.</p>
        @endif

        <p style="margin:16px 0 0 0; color:#cccccc;">
          Besoin d’aide ? Tu peux nous contacter via le <strong>Chat en Direct</strong> pour prendre un rendez-vous.
          Tarif : <strong>{{ $appointment_rate ?? '1000 FCFA / heure' }}</strong>.
        </p>

        @if(!empty($chat_url))
          <p style="margin: 14px 0 0 0;">
              <a class="button" href="{{ $chat_url }}">Demander une assistance (rendez-vous)</a>
          </p>
        @endif
      </div>
    @endif

  <p style="color:#cccccc; font-size:13px;"><strong>Important :</strong> gardez ces informations en sécurité.</p>
@endcomponent