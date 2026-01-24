<!DOCTYPE html>
<html>
<head>
    <title>Vos identifiants de jeu BADBOYSHOP</title>
</head>
<body>
    <h1>Félicitations ! Votre commande est livrée</h1>

    <p>Bonjour {{ $order->user->name }},</p>

    <p>Votre paiement a été confirmé et voici vos identifiants de jeu :</p>

    <div style="background: #f0f0f0; padding: 20px; margin: 20px 0;">
        <h3>{{ $game->name }}</h3>
        @foreach($account_details as $key => $value)
            <p><strong>{{ ucfirst($key) }}:</strong> {{ $value }}</p>
        @endforeach
    </div>

    <p><strong>Important :</strong> Conservez ces identifiants en sécurité. Ils ne seront plus visibles dans votre espace client après 24h pour des raisons de sécurité.</p>

    <p>Si vous avez des questions, contactez-nous sur WhatsApp : +228 93 97 06 11</p>

    <p>Cordialement,<br>L'équipe BADBOYSHOP</p>
</body>
</html>