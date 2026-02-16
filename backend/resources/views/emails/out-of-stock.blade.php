@component('emails.layout', ['title' => 'Commande en attente', 'logo' => ($logo ?? null)])
	<h2 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:18px;line-height:22px;color:#111111;">Commande payée – En attente</h2>

	<p>Bonjour {{ $order->user?->name ?? 'Client' }},</p>
	<p>Votre commande <strong>{{ $order->reference ?? $order->id }}</strong> a bien été payée, mais certains codes sont actuellement en rupture de stock.</p>

	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0;border:1px solid #e5e5e5;background-color:#f7f7f7;">
		<tr>
			<td style="padding:12px;font-family:Arial, sans-serif;font-size:14px;line-height:20px;color:#111111;">
				<p style="margin:0;">Nous relançons le réapprovisionnement et nous vous livrons dès que possible.</p>
			</td>
		</tr>
	</table>

	<p>Merci pour votre patience.</p>
@endcomponent
