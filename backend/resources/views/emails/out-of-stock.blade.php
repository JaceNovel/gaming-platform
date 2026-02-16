@component('emails.layout', ['title' => 'Commande en attente', 'logo' => ($logo ?? null)])
	<h2 style="margin:0 0 10px 0; color:#ffd166;">Commande payée – En attente ⏳</h2>

	<p>Bonjour {{ $order->user?->name ?? 'Client' }},</p>
	<p>Votre commande <strong>{{ $order->reference ?? $order->id }}</strong> a bien été payée, mais certains codes sont actuellement en rupture de stock.</p>

	<div class="highlight">
			<p style="margin:0;">Nous relançons le réapprovisionnement et nous vous livrons dès que possible.</p>
	</div>

	<p>Merci pour votre patience.</p>
@endcomponent
