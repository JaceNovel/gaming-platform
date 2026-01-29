@component('emails.layout', ['title' => 'Code de recharge', 'logo' => ($logo ?? null)])
	<h2 style="margin:0 0 10px 0; color:#00ff99;">Recharge prête ✅</h2>

	<p>Bonjour {{ $order->user->name ?? 'Badboy' }},</p>
	<p>Votre commande <strong>{{ $order->reference }}</strong> est confirmée. Voici votre/vos code(s) :</p>

	<div class="highlight">
		<ul style="margin:0; padding-left:18px;">
			@foreach ($codes as $code)
				@php($denomination = $code->denomination)
				<li style="margin:8px 0;">
					<strong>{{ $denomination->label ?? 'Recharge' }} ({{ $denomination->diamonds }} diamants)</strong>
					: <span style="font-family:monospace; font-size:14px;">{{ $code->code }}</span>
				</li>
			@endforeach
		</ul>
	</div>

	<h3 style="margin:18px 0 8px 0;">Instructions</h3>
	<ol style="margin:0; padding-left:18px; color:#cccccc;">
		<li>Ouvrez Free Fire et accédez au centre de recharge.</li>
		<li>Sélectionnez "Utiliser un code" puis saisissez le code ci-dessus.</li>
		<li>Validez pour recevoir vos diamants.</li>
	</ol>

	<p style="margin-top:16px;">Guide Shop2Game : <a style="color:#7dd3fc;" href="{{ $guideUrl ?? url('/api/guides/shop2game-freefire') }}">ouvrir le guide</a></p>
@endcomponent
