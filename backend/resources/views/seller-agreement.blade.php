<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Certificat vendeur - PRIME Gaming</title>
    <style>
        @page { margin: 28px; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #111827; position: relative; }
        h1 { font-size: 20px; margin: 0 0 4px 0; color: #0f172a; }
        h2 { font-size: 14px; margin: 16px 0 8px 0; color: #111827; }
        p { margin: 6px 0; line-height: 1.45; }
        .muted { color: #6b7280; }
        .hero {
            border: 1px solid #d1d5db;
            background: #f8fafc;
            border-radius: 10px;
            padding: 12px;
        }
        .box {
            border: 1px solid #d1d5db;
            padding: 10px;
            border-radius: 8px;
            background: #ffffff;
        }
        .row { margin: 6px 0; }
        .label { color: #6b7280; display: inline-block; min-width: 180px; }
        ul { margin: 6px 0 6px 18px; padding: 0; }
        li { margin: 4px 0; }
        .signature {
            margin-top: 18px;
            border-top: 1px dashed #cbd5e1;
            padding-top: 10px;
        }
        .footer { margin-top: 16px; font-size: 10px; color: #6b7280; }
        .watermark {
            position: fixed;
            top: 42%;
            left: 50%;
            width: 120%;
            text-align: center;
            transform: translate(-50%, -50%) rotate(-31deg);
            font-size: 34px;
            color: rgba(15, 23, 42, 0.06);
            letter-spacing: 2px;
            z-index: -1;
            white-space: nowrap;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="watermark">{{ (string)($watermarkText ?? 'PRIME GAMING') }}</div>

    <h1>Certificat vendeur — PRIME Gaming</h1>
    <p class="muted">Document personnalisé généré automatiquement lors de la validation admin.</p>

    <div class="hero">
        <p><strong>Merci {{ (string)($seller->kyc_full_name ?? 'Vendeur') }}</strong> d’avoir souscrit au programme vendeur PRIME Gaming.</p>
        <p>
            Votre dossier a été validé pour la marketplace. Ce document est personnel, nominatif et
            protégé par filigrane anti-reproduction.
        </p>
    </div>

    <div class="box">
        <div class="row"><span class="label">Entreprise:</span> {{ (string)($seller->company_name ?? '—') }}</div>
        <div class="row"><span class="label">Vendeur (KYC):</span> {{ (string)($seller->kyc_full_name ?? '') }}</div>
        <div class="row"><span class="label">Email compte:</span> {{ (string)($seller->user?->email ?? '') }}</div>
        <div class="row"><span class="label">WhatsApp vendeur:</span> {{ (string)($seller->whatsapp_number ?? '') }}</div>
        <div class="row"><span class="label">Statut vendeur:</span> {{ (string)($seller->status ?? '') }}</div>
        <div class="row"><span class="label">Validé le:</span> {{ ($issuedAt ?? $seller->approved_at)?->toDateTimeString() ?? '' }}</div>
        <div class="row"><span class="label">ID vendeur:</span> #{{ (int)$seller->id }}</div>
        <div class="row"><span class="label">Référence certificat:</span> {{ (string)($certificateCode ?? 'PG-SLR-NA') }}</div>
    </div>

    <h2>1) Fonctionnement</h2>
    <ul>
        <li>Vous publiez des annonces (comptes gaming) soumises à validation.</li>
        <li>Après paiement confirmé, la commande apparaît dans « Mes ventes ».</li>
        <li>Vous livrez sous 24H et ajoutez une preuve de livraison (image) pour marquer « livré ».</li>
        <li>En cas de litige, PRIME Gaming peut geler temporairement le wallet partenaire jusqu’à résolution.</li>
    </ul>

    <h2>2) Conditions vendeur (obligatoires)</h2>
    <ul>
        <li>Fournir des informations exactes et à jour (KYC + WhatsApp).</li>
        <li>Publier uniquement des annonces réelles et conformes; toute fraude entraîne la suppression et des sanctions.</li>
        <li>Respecter les délais de livraison indiqués (objectif: 24H).</li>
        <li>Fournir une preuve de livraison lorsque demandé.</li>
        <li>Respecter les règles de sécurité: ne jamais demander un paiement hors plateforme.</li>
        <li>Pour les vendeurs non-VIP: plafond de ventes mensuelles à 80 000 FCFA. Au-delà, passage VIP requis.</li>
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

    <div class="signature">
        <p><strong>Signé électroniquement — PrimeGaming</strong></p>
        <p class="muted">Document nominatif, valable uniquement pour le vendeur ci-dessus.</p>
    </div>

    <p class="footer">
        Ce document est personnel et protégé par filigrane. Toute tentative de reproduction ou de falsification est interdite.
    </p>
</body>
</html>
