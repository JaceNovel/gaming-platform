<!DOCTYPE html>
<html>
<head>
    <title>Confirmation de recharge BADBOYSHOP</title>
</head>
<body>
    <h1>Votre recharge a été effectuée avec succès !</h1>

    <p>Bonjour {{ $order->user->name ?? 'client' }},</p>

    <p>Votre paiement a été confirmé et votre compte a été rechargé :</p>

    <div style="background: #f0f0f0; padding: 20px; margin: 20px 0;">
        <h3>Détails de la recharge</h3>
        <p><strong>Montant rechargé :</strong> {{ number_format($order->total_price ?? $order->total_amount ?? 0, 0, ',', ' ') }} FCFA</p>
        <p><strong>Numéro de compte :</strong> {{ $topupDetails['account_number'] ?? $orderItem->game_user_id ?? 'N/A' }}</p>
        <p><strong>Opérateur :</strong> {{ $topupDetails['operator'] ?? 'Mobile Money' }}</p>
        <p><strong>Date :</strong> {{ optional($order->created_at)->format('d/m/Y H:i') }}</p>
    </div>

    <p>La recharge devrait être visible sur votre compte dans les prochaines minutes.</p>

    <p>Si vous n'avez pas reçu la recharge dans 1 heure, contactez-nous sur WhatsApp : +228 93 97 06 11</p>

    <p>Cordialement,<br>L'équipe BADBOYSHOP</p>
</body>
</html>