# Backend Laravel — PRIME Gaming API

API backend pour la plateforme gaming. Le frontend Next.js consomme cette API via `NEXT_PUBLIC_API_URL`.

## Démarrer en local

1) Installer les dépendances

- `composer install`

2) Copier le fichier d'environnement

- `cp .env.example .env`
- `php artisan key:generate`

3) Configurer la base de données dans `.env`

4) Lancer les migrations

- `php artisan migrate`

5) Démarrer l’API

- `php artisan serve`

Base API locale: `http://127.0.0.1:8000/api`

## Variables d’environnement (prod)

Minimum recommandé:

- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://TON_BACKEND_URL`
- `FRONTEND_URL=https://TON_FRONT_URL`
- `VERCEL_URL=xxxxx.vercel.app` (optionnel)
- `DB_CONNECTION=mysql` ou `pgsql`
- `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`

Si usage de cookies/Sanctum:

- `CORS_SUPPORTS_CREDENTIALS=true`

### Play Integrity (Android)

- `PLAY_INTEGRITY_PACKAGE_NAME=space.primegaming.app`
- `PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON=` (contenu JSON complet, optionnel)
- `PLAY_INTEGRITY_SERVICE_ACCOUNT_PATH=/path/to/service-account.json` (optionnel)
- `SUPPORT_URL=https://space.primegaming.app/support`

### Moneroo

Variables utiles:

- `MONEROO_ENABLED=true`
- `MONEROO_PUBLIC_KEY=`
- `MONEROO_SECRET_KEY=`
- `MONEROO_WEBHOOK_SECRET=`
- `MONEROO_RETURN_URL=` (optionnel, sinon derive de `APP_URL`)
- `MONEROO_FRONTEND_STATUS_URL=` (optionnel, sinon derive de `FRONTEND_URL`)

Webhook backend expose par le projet:

- `POST https://api.primegaming.space/api/payments/moneroo/webhook`
- `POST https://api.primegaming.space/api/payouts/moneroo/webhook`

Le header de signature attendu est:

- `X-Moneroo-Signature`

Le secret configure dans le dashboard Moneroo doit etre identique a `MONEROO_WEBHOOK_SECRET` cote backend.

## Endpoints requis par le frontend

- `POST /api/register`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/me`
- `PATCH /api/me`
- `GET /api/products`
- `GET /api/products/{id}`
- `GET /api/orders`
- `POST /api/orders`
- `GET /api/wallet`

## Health check

- `GET /api/health` → `{ "ok": true, "app": "PRIME Gaming", "time": "...", "env": "production" }`

## Build / perf (prod)

- `php artisan config:cache`
- `php artisan route:cache`
- `php artisan optimize`

## Déploiement

1) Déployer le backend (Railway/Render/VPS)
2) Lancer `php artisan migrate --force`
3) Configurer l’URL front dans `FRONTEND_URL`

URL base API en prod: `https://TON_BACKEND_URL/api`

## App Links

Le fichier App Links doit etre servi par le backend:

- `backend/public/.well-known/assetlinks.json`

## Push segmentation (FCM/Web)

Commandes utiles:

- `php artisan notifications:send-segment new_users_24h --body="Bienvenue sur PRIME Gaming" --url=/shop`
- `php artisan notifications:send-segment inactive_7d --body="Tu nous manques" --url=/shop`
- `php artisan notifications:send-segment free_fire_buyers --body="Promo Free Fire" --url=/recharges/free-fire`
- `php artisan notifications:send-segment premium --body="Avantages VIP" --url=/account`

Panier abandonne:

- `php artisan notifications:cart-abandoned --hours=6 --order-hours=24`

## Checklist rapide

- `curl https://api.primegaming.space/api/health`
- Tester `register/login` depuis https://primegaming.space
- Vérifier CORS (aucune erreur console)

## Render

Backend (Docker):
- Utilise le Dockerfile dans `backend/`
- Ne pas lancer les migrations dans le build
- Commandes à lancer après déploiement: `php artisan migrate --force`

Variables env minimales:
- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://api.primegaming.space`
- `FRONTEND_URL=https://primegaming.space`
- `DB_CONNECTION=mysql` (ou `pgsql`)
- `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
- `CORS_SUPPORTS_CREDENTIALS=true`
- `SANCTUM_STATEFUL_DOMAINS=primegaming.space`
- `SESSION_DOMAIN=.primegaming.space`

### Uploads publics (annonces marketplace, photos litiges)

Ces fichiers sont ecrits sur le disque defini par `PUBLIC_UPLOADS_DISK` (par defaut: `public`).

- Pour une durabilite maximale (ne jamais perdre les images lors d'un redeploy), utiliser S3:
  - `PUBLIC_UPLOADS_DISK=s3`
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `AWS_BUCKET`
  - Optionnel (S3-compatible): `AWS_ENDPOINT`, `AWS_URL`, `AWS_USE_PATH_STYLE_ENDPOINT`
  - Optionnel: `AWS_PUBLIC_UPLOADS_VISIBILITY=public` (defaut)

Acces cote frontend: via l'API `/api/storage/...`.
