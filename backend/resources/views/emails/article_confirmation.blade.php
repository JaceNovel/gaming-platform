<!DOCTYPE html>
<html>
<head>
    <title>Confirmation de commande BADBOYSHOP</title>
</head>
<body>
    <h1>Votre commande a été confirmée !</h1>

    <p>Bonjour {{ $order->user->name ?? 'client' }},</p>

    <p>Votre paiement a été confirmé et votre commande est en cours de traitement :</p>

    <div style="background: #f0f0f0; padding: 20px; margin: 20px 0;">
        <h3>Détails de la commande</h3>
        <p><strong>Article :</strong> {{ $orderItem->product->name ?? $article->name ?? 'Article' }}</p>
        <p><strong>Montant payé :</strong> {{ number_format($order->total_price ?? $order->total_amount ?? 0, 0, ',', ' ') }} FCFA</p>
        <p><strong>Référence commande :</strong> {{ $order->reference }}</p>
        <p><strong>Date :</strong> {{ optional($order->created_at)->format('d/m/Y H:i') }}</p>
    </div>

    <p>Votre article sera livré selon les modalités convenues. Vous recevrez un email de suivi avec les détails de livraison.</p>

    <p>Pour toute question, contactez-nous sur WhatsApp : +228 93 97 06 11</p>

    <p>Cordialement,<br>L'équipe BADBOYSHOP</p>
</body>
</html>