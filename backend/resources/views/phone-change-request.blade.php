<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Demande de changement de numéro</title>
  <style>
    body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 12px; color: #111; }
    .h { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .sub { color: #555; margin-bottom: 18px; }
    .box { border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
    .row { margin: 6px 0; }
    .k { display: inline-block; width: 160px; color: #555; }
    .v { font-weight: 600; }
  </style>
</head>
<body>
  <div class="h">Demande de changement de numéro</div>
  <div class="sub">Document généré le {{ now()->format('d/m/Y H:i') }}</div>

  <div class="box">
    <div class="row"><span class="k">Demande #</span><span class="v">{{ $requestRow->id }}</span></div>
    <div class="row"><span class="k">Statut</span><span class="v">{{ strtoupper($requestRow->status) }}</span></div>
    <div class="row"><span class="k">Créée le</span><span class="v">{{ optional($requestRow->created_at)->format('d/m/Y H:i') }}</span></div>
  </div>

  <div class="box">
    <div class="row"><span class="k">Utilisateur</span><span class="v">{{ $user->name }} (ID {{ $user->id }})</span></div>
    <div class="row"><span class="k">Email</span><span class="v">{{ $user->email }}</span></div>
  </div>

  <div class="box">
    <div class="row"><span class="k">Ancien numéro</span><span class="v">{{ $requestRow->old_phone }}</span></div>
    <div class="row"><span class="k">Nouveau numéro</span><span class="v">{{ $requestRow->new_phone }}</span></div>
    <div class="row"><span class="k">Motif</span><span class="v">{{ $requestRow->reason ?: '—' }}</span></div>
  </div>
</body>
</html>
