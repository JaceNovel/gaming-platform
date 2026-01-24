# Backend Laravel — BADBOYSHOP API

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
- `POST /api/wallet/topup/init`
- `POST /api/transfers/init`
- `GET /api/transfers/history`

## Health check

- `GET /api/health` → `{ "ok": true, "app": "BADBOYSHOP", "time": "...", "env": "production" }`

## Build / perf (prod)

- `php artisan config:cache`
- `php artisan route:cache`
- `php artisan optimize`

## Déploiement

1) Déployer le backend (Railway/Render/VPS)
2) Lancer `php artisan migrate --force`
3) Configurer l’URL front dans `FRONTEND_URL`

URL base API en prod: `https://TON_BACKEND_URL/api`

## Checklist rapide

- `curl https://api.badboyshop.online/api/health`
- Tester `register/login` depuis https://badboyshop.online
- Vérifier CORS (aucune erreur console)
