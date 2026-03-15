<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Refus demande Premium - PRIME Gaming</title>
    <style>
        @page { margin: 28px; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #111827; }
        h1 { font-size: 21px; margin: 0 0 6px 0; }
        p { margin: 6px 0; line-height: 1.45; }
        .box { border: 1px solid #d1d5db; border-radius: 10px; padding: 12px; background: #fff; }
        ul { margin: 8px 0 8px 18px; }
        li { margin: 4px 0; }
        .muted { color: #6b7280; }
    </style>
</head>
<body>
    <h1>Récapitulatif du refus Premium</h1>
    <p class="muted">Document interne transmis au demandeur si l'envoi email est activé.</p>

    <div class="box">
        <p><strong>Utilisateur:</strong> {{ (string) ($user->name ?? '—') }}</p>
        <p><strong>Plan demandé:</strong> {{ (string) ($plan['label'] ?? '—') }}</p>
        <p><strong>Date:</strong> {{ optional($issuedAt)->format('d/m/Y H:i') }}</p>
    </div>

    <p style="margin-top: 16px;"><strong>Conditions non respectées</strong></p>
    <ul>
        @foreach((array) ($reasons ?? []) as $reason)
            <li>{{ (string) $reason }}</li>
        @endforeach
    </ul>

    @if(!empty($adminNote))
        <p><strong>Note admin:</strong> {{ (string) $adminNote }}</p>
    @endif
</body>
</html>