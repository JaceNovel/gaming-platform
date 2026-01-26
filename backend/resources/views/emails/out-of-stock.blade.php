<h1>Commande payée – en attente de réapprovisionnement</h1>
<p>Bonjour {{ $order->user?->name ?? 'Client' }},</p>
<p>Votre commande {{ $order->reference ?? $order->id }} a bien été payée, mais les codes Free Fire sont en rupture de stock.</p>
<p>Nous revenons vers vous dès le réapprovisionnement. Merci pour votre patience.</p>
<p>Support WhatsApp : +225 0700000000</p>
