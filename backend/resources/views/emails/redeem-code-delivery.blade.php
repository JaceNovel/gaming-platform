@component('mail::message')
# Recharge confirmée

Bonjour {{ $order->user->name ?? 'Badboy' }},

Votre paiement pour la commande **{{ $order->reference }}** est confirmé. Voici votre code :

@foreach ($codes as $code)
@php($denomination = $code->denomination)
- **{{ $denomination->label ?? 'Recharge' }} ({{ $denomination->diamonds }} diamants)** : `{{ $code->code }}`
@endforeach

**Instructions**
1. Ouvrez Free Fire et accédez au centre de recharge.
2. Sélectionnez "Utiliser un code" puis saisissez le code ci-dessus.
3. Validez pour recevoir instantanément vos diamants.

Télécharger le guide Shop2Game : {{ $guideUrl ?? url('/api/guides/shop2game-freefire') }}

Besoin d'aide ? Répondez simplement à cet email.

Merci,
L'équipe BADBOYSHOP
@endcomponent
