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

	<p style="margin:16px 0 0 0; color:#cccccc;">
		Utilisation rapide : Free Fire → Centre de recharge → Utiliser un code → collez le code.
	</p>

	<p style="margin-top:14px;">
		Guide (PDF) : <a style="color:#7dd3fc;" href="{{ $guideUrl }}">télécharger</a>
	</p>
@endcomponent
