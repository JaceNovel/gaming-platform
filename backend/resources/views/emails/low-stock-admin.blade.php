@component('emails.layout', ['title' => 'Stock bas', 'logo' => ($logo ?? null)])
	<h2 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:18px;line-height:22px;color:#111111;">Stock bas Redeem Codes</h2>

	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0;border:1px solid #e5e5e5;background-color:#f7f7f7;">
		<tr>
			<td style="padding:12px;font-family:Arial, sans-serif;font-size:14px;line-height:20px;color:#111111;">
				<p style="margin:6px 0;"><strong>Produit :</strong> {{ $denomination->product?->name ?? $denomination->label ?? 'Recharge' }}</p>
				<p style="margin:6px 0;"><strong>Stock disponible :</strong> {{ $available }}</p>
				<p style="margin:6px 0;"><strong>Seuil :</strong> {{ $threshold }}</p>
			</td>
		</tr>
	</table>

	<p>Action requise : réapprovisionner dès que possible.</p>
@endcomponent
