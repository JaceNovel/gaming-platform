@component('emails.layout', ['title' => 'Stock bas', 'logo' => ($logo ?? null)])
	<h2 style="margin:0 0 10px 0; color:#ffd166;">⚠️ Stock bas Redeem Codes</h2>

	<div class="highlight">
		<p style="margin:6px 0;"><strong>Produit :</strong> {{ $denomination->product?->name ?? $denomination->label ?? 'Recharge' }}</p>
		<p style="margin:6px 0;"><strong>Stock disponible :</strong> {{ $available }}</p>
		<p style="margin:6px 0;"><strong>Seuil :</strong> {{ $threshold }}</p>
	</div>

	<p>Action requise : réapprovisionner dès que possible.</p>
@endcomponent
