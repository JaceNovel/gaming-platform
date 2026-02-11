<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Accord vendeur - PRIME Gaming</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #111; }
        h1 { font-size: 18px; margin: 0 0 6px 0; }
        h2 { font-size: 14px; margin: 18px 0 8px 0; }
        p { margin: 6px 0; line-height: 1.4; }
        .muted { color: #555; }
        .box { border: 1px solid #ddd; padding: 10px; border-radius: 6px; }
        .row { margin: 6px 0; }
        .label { color: #555; display: inline-block; min-width: 170px; }
        ul { margin: 6px 0 6px 18px; padding: 0; }
        li { margin: 4px 0; }
        .footer { margin-top: 18px; font-size: 10px; color: #666; }
    </style>
</head>
<body>
    <h1>Accord vendeur — Marketplace PRIME Gaming</h1>
    <p class="muted">Document généré automatiquement lors de la validation du vendeur.</p>

    <div class="box">
        <div class="row"><span class="label">Vendeur (KYC):</span> {{ (string)($seller->kyc_full_name ?? '') }}</div>
        <div class="row"><span class="label">Email compte:</span> {{ (string)($seller->user?->email ?? '') }}</div>
        <div class="row"><span class="label">WhatsApp vendeur:</span> {{ (string)($seller->whatsapp_number ?? '') }}</div>
        <div class="row"><span class="label">Statut vendeur:</span> {{ (string)($seller->status ?? '') }}</div>
        <div class="row"><span class="label">Validé le:</span> {{ $seller->approved_at?->toDateTimeString() ?? '' }}</div>
        <div class="row"><span class="label">ID vendeur:</span> #{{ (int)$seller->id }}</div>
    </div>

    <h2>1) Fonctionnement</h2>
    <ul>
        <li>Vous publiez des annonces (comptes gaming) soumises à validation.</li>
        <li>Après paiement confirmé, la commande apparaît dans « Mes ventes ».</li>
        <li>Vous livrez sous 24H et ajoutez une preuve de livraison (image) pour marquer « livré ».</li>
        <li>En cas de litige, PRIME Gaming peut geler temporairement le wallet partenaire jusqu’à résolution.</li>
    </ul>

    <h2>2) Obligations vendeur</h2>
    <ul>
        <li>Fournir des informations exactes et à jour (KYC + WhatsApp).</li>
        <li>Respecter les délais de livraison indiqués (objectif: 24H).</li>
        <li>Fournir une preuve de livraison lorsque demandé.</li>
        <li>Respecter les règles de sécurité: ne jamais demander un paiement hors plateforme.</li>
    </ul>

    <h2>3) Vérification du contact (sécurité anti-fraude)</h2>
    <p>
        Important: lorsqu’un acheteur vous contacte, vous devez vérifier que le numéro qui vous contacte
        est <strong>identique</strong> au numéro affiché sur la commande (numéro utilisé lors du paiement).
        Si le numéro est différent, vous devez <strong>suspendre la livraison</strong> et signaler la situation.
    </p>

    <h2>4) Paiements, gains et commissions</h2>
    <ul>
        <li>Les commissions sont appliquées automatiquement selon les règles de la marketplace.</li>
        <li>Les gains peuvent rester « en attente » et nécessiter une validation admin avant libération.</li>
        <li>Le wallet partenaire peut être gelé en cas de suspicion de fraude ou litige.</li>
    </ul>

    <h2>5) Sanctions</h2>
    <ul>
        <li>En cas de non-respect des règles (retards répétés, fraude, contournement, faux KYC), le compte vendeur peut être suspendu ou banni.</li>
        <li>Le gel du wallet partenaire peut être appliqué pour protéger les acheteurs et la plateforme.</li>
    </ul>

    <p class="footer">
        Ce document est fourni à titre informatif et de conformité interne. En utilisant la marketplace PRIME Gaming, vous acceptez ces règles.
    </p>
</body>
</html>
