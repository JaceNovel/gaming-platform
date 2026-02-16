@component('emails.layout', ['title' => 'Code de recharge', 'logo' => ($logo ?? null)])
	<h2 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:18px;line-height:22px;color:#111111;">Recharge prête</h2>

	<p>Bonjour {{ $order->user->name ?? 'Prime' }},</p>
	<p>Votre commande <strong>{{ $order->reference }}</strong> est confirmée. Voici votre/vos code(s) :</p>

	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0;border:1px solid #e5e5e5;background-color:#f7f7f7;">
		<tr>
			<td style="padding:12px;font-family:Arial, sans-serif;font-size:14px;line-height:20px;color:#111111;">
				<ul style="margin:0;padding-left:18px;">
					@foreach ($codes as $code)
						@php($denomination = $code->denomination)
						<li style="margin:8px 0;">
							<strong>{{ $denomination->label ?? 'Recharge' }} ({{ $denomination->diamonds }} diamants)</strong>
							: <span style="font-family:monospace;font-size:14px;">{{ $code->code }}</span>
						</li>
					@endforeach
				</ul>
			</td>
		</tr>
	</table>

	<p style="margin:16px 0 0 0;color:#666666;font-size:13px;line-height:18px;">
		Utilisation rapide : Free Fire → Centre de recharge → Utiliser un code → collez le code.
	</p>

	<p style="margin-top:14px;">
		Guide (PDF) : <a style="color:#1155cc;" href="{{ $guideUrl }}">télécharger</a>
	</p>
@endcomponent
