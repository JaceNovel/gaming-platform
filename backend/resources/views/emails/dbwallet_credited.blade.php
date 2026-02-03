<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DBWallet crédité</title>
  </head>
  <body style="margin:0;padding:0;background:#0b1220;color:#e2e8f0;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:24px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
        @if(!empty($logo))
          <img src="{{ $logo }}" alt="BADBOYSHOP" style="height:36px;width:auto;" />
        @endif
        <div style="font-weight:700;letter-spacing:0.4px;">BADBOYSHOP</div>
      </div>

      <div style="background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:18px;">
        <h2 style="margin:0 0 10px 0;font-size:18px;">Votre DBWallet a été crédité</h2>
        <p style="margin:0 0 10px 0;opacity:0.9;">
          Montant : <strong>+{{ number_format((float) $amount, 0, ',', ' ') }} FCFA</strong>
        </p>
        <p style="margin:0 0 6px 0;opacity:0.85;">Wallet ID : <strong>{{ $wallet->wallet_id }}</strong></p>
        <p style="margin:0 0 6px 0;opacity:0.85;">Référence : <strong>{{ $reference }}</strong></p>
        @if(!empty($reason))
          <p style="margin:0 0 6px 0;opacity:0.85;">Motif : {{ $reason }}</p>
        @endif
        <p style="margin:14px 0 0 0;opacity:0.75;font-size:12px;">Si vous n'êtes pas à l'origine de cette demande, contactez immédiatement le support.</p>
      </div>

      <p style="margin:16px 0 0 0;opacity:0.6;font-size:12px;">© {{ date('Y') }} BADBOYSHOP</p>
    </div>
  </body>
</html>
