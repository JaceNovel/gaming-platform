<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Retrait payé</title>
</head>
<body style="font-family: Arial, sans-serif; background:#0b0f1a; color:#e5e7eb; margin:0; padding:24px;">
    <div style="max-width:640px; margin:0 auto; background:#0f172a; border:1px solid #1f2937; border-radius:12px; padding:20px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
            @if($logo)
                <img src="{{ $logo }}" alt="Logo" style="height:36px; width:auto;" />
            @endif
            <div>
                <div style="font-size:18px; font-weight:700;">DB Partner</div>
                <div style="font-size:12px; color:#94a3b8;">Notification de paiement</div>
            </div>
        </div>

        <p style="margin:0 0 12px 0;">Votre demande de retrait a été marquée comme <strong>payée</strong>.</p>

        <div style="background:#0b1220; border:1px solid #1f2937; border-radius:10px; padding:14px; margin:12px 0;">
            <div style="font-size:14px; margin-bottom:6px;"><strong>Montant:</strong> {{ number_format((float) $withdraw->amount, 0, ',', ' ') }} FCFA</div>
            <div style="font-size:14px; margin-bottom:6px;"><strong>Statut:</strong> {{ $withdraw->status }}</div>
            <div style="font-size:14px;"><strong>Date:</strong> {{ optional($withdraw->processed_at)->toDateTimeString() }}</div>
        </div>

        <p style="margin:0; color:#94a3b8; font-size:12px;">Si vous n'êtes pas à l'origine de cette demande, contactez le support.</p>
    </div>
</body>
</html>
