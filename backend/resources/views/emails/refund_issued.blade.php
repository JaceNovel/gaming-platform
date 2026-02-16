@component('emails.layout', ['title' => 'Remboursement', 'logo' => ($logo ?? null)])
    <h2 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:18px;line-height:22px;color:#111111;">Remboursement effectué</h2>

    <p>Bonjour {{ $order->user?->name ?? 'Client' }},</p>

    <p>
        Un article de votre commande <strong>{{ $order->reference ?? $order->id }}</strong> était indisponible.
        Le montant a été remboursé sur votre wallet.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0;border:1px solid #e5e5e5;background-color:#f7f7f7;">
        <tr>
            <td style="padding:12px;font-family:Arial, sans-serif;font-size:14px;line-height:20px;color:#111111;">
                <p style="margin:6px 0;"><strong>Montant remboursé :</strong> {{ number_format((float) ($refund->amount ?? 0), 0, ',', ' ') }} FCFA</p>
                <p style="margin:6px 0;"><strong>Statut :</strong> crédité sur votre wallet</p>
                @if(!empty($refund->reason))
                    <p style="margin:6px 0;"><strong>Raison :</strong> {{ $refund->reason }}</p>
                @endif
            </td>
        </tr>
    </table>

    <p>Merci pour votre compréhension.</p>
@endcomponent
