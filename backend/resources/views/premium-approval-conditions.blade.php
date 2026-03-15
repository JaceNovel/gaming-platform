<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Conditions Premium - PRIME Gaming</title>
    <style>
        @page { margin: 28px; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #111827; }
        h1 { font-size: 21px; margin: 0 0 6px 0; }
        h2 { font-size: 14px; margin: 18px 0 8px 0; }
        p { margin: 6px 0; line-height: 1.45; }
        .hero, .box { border: 1px solid #d1d5db; border-radius: 10px; padding: 12px; }
        .hero { background: #f8fafc; }
        .box { background: #fff; margin-top: 12px; }
        ul { margin: 6px 0 6px 18px; }
        li { margin: 4px 0; }
        .muted { color: #6b7280; }
    </style>
</head>
<body>
    <h1>Conditions du partenariat Premium</h1>
    <p class="muted">Document remis après validation admin.</p>

    <div class="hero">
        <p><strong>{{ (string) ($user->name ?? 'Partenaire') }}</strong>, Prime est heureux de t'accueillir dans le programme {{ (string) ($plan['label'] ?? 'Premium') }}.</p>
        <p>Ce document rappelle les directives à respecter pour rester partenaire officiel de PRIME Gaming et KING League.</p>
    </div>

    <div class="box">
        <p><strong>Plan:</strong> {{ (string) ($plan['label'] ?? 'Premium') }}</p>
        <p><strong>Plafond annoncé:</strong> {{ (string) ($plan['earnings_ceiling'] ?? '—') }}</p>
        <p><strong>Date de validation:</strong> {{ optional($issuedAt)->format('d/m/Y H:i') }}</p>
    </div>

    <h2>Directives obligatoires</h2>
    <ul>
        @foreach((array) ($plan['requirements'] ?? []) as $requirement)
            <li>{{ (string) $requirement }}</li>
        @endforeach
    </ul>

    <h2>Rappel du programme</h2>
    <ul>
        @foreach((array) ($plan['benefits'] ?? []) as $benefit)
            <li>{{ (string) $benefit }}</li>
        @endforeach
    </ul>

    <h2>Cadence attendue</h2>
    <p>Le partenaire doit publier au minimum 1 à 2 vidéos par semaine et maintenir une présence active autour de PRIMEgaming.space, KING League et de l'application PRIME Gaming sur Play Store.</p>

    <h2>Canaux recommandés</h2>
    <p>YouTube, Instagram, TikTok, Discord et WhatsApp peuvent être utilisés selon ton audience, tant que la communication reste conforme à l'image de PRIME Gaming.</p>
</body>
</html>