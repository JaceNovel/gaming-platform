<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Certificat de partenariat - PRIME Gaming</title>
    <style>
        @page { margin: 30px; }
        body { font-family: DejaVu Sans, sans-serif; color: #0f172a; text-align: center; }
        .frame { border: 4px solid #0f172a; padding: 40px 30px; min-height: 640px; }
        .muted { color: #64748b; }
        h1 { font-size: 26px; margin-top: 30px; }
        h2 { font-size: 18px; margin: 16px 0; }
        p { line-height: 1.55; }
        .code { margin-top: 28px; font-size: 12px; color: #475569; }
    </style>
</head>
<body>
    <div class="frame">
        <p class="muted">PRIME Gaming x KING League</p>
        <h1>Certificat de partenariat officiel</h1>
        <p>Le présent document certifie que</p>
        <h2>{{ strtoupper((string) ($user->name ?? 'PARTENAIRE')) }}</h2>
        <p>est reconnu comme <strong>partenaire officiel de PRIME Gaming et KING League</strong> dans le cadre du programme {{ (string) ($plan['label'] ?? 'Premium') }}.</p>
        <p>Ce partenariat autorise la promotion des plateformes, contenus, offres et campagnes validées par PRIME Gaming selon les directives communiquées.</p>
        <p>Délivré le {{ optional($issuedAt)->format('d/m/Y à H:i') }}.</p>
        <p class="code">Référence certificat: {{ (string) ($certificateCode ?? 'PRM-NA') }}</p>
    </div>
</body>
</html>