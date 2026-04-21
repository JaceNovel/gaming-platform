# Déploiement VPS Hostinger

Cette configuration sert le frontend Next.js sur `primegaming.space` et le backend Laravel sur `api.primegaming.space`.

## Architecture cible

- Frontend: Node.js 22 + Next.js, servi par `next start` sur `127.0.0.1:3000`
- Backend: Nginx + PHP-FPM 8.2, servi depuis `backend/public`
- Queue Laravel: service systemd séparé
- Scheduler Laravel: timer systemd ou cron
- Base de données: MySQL ou MariaDB

## 1. Paquets système

```bash
sudo apt update
sudo apt install -y nginx mysql-server unzip git curl ca-certificates software-properties-common
sudo add-apt-repository ppa:ondrej/php -y
sudo apt update
sudo apt install -y php8.2 php8.2-cli php8.2-fpm php8.2-mysql php8.2-mbstring php8.2-xml php8.2-curl php8.2-zip php8.2-bcmath php8.2-gd
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
```

## 2. Arborescence serveur

```bash
sudo mkdir -p /var/www/gaming-platform
sudo chown -R $USER:$USER /var/www/gaming-platform
git clone https://github.com/JaceNovel/gaming-platform.git /var/www/gaming-platform
cd /var/www/gaming-platform
```

## 3. Base de données

```bash
sudo mysql
CREATE DATABASE gaming_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'gaming_platform'@'localhost' IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON gaming_platform.* TO 'gaming_platform'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 4. Backend Laravel

```bash
cd /var/www/gaming-platform/backend
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
```

Variables minimales à renseigner dans `backend/.env`:

```env
APP_NAME="PRIME Gaming"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.primegaming.space

FRONTEND_URL=https://primegaming.space
CORS_SUPPORTS_CREDENTIALS=true
SANCTUM_STATEFUL_DOMAINS=primegaming.space,www.primegaming.space
SESSION_DOMAIN=.primegaming.space
SESSION_SECURE_COOKIE=true

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=gaming_platform
DB_USERNAME=gaming_platform
DB_PASSWORD=CHANGE_ME_STRONG_PASSWORD

CACHE_STORE=database
SESSION_DRIVER=database
QUEUE_CONNECTION=database
PUBLIC_UPLOADS_DISK=public
```

Ensuite:

```bash
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan storage:link
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R 775 storage bootstrap/cache
```

## 5. Frontend Next.js

```bash
cd /var/www/gaming-platform/frontend
npm install
```

Créer `frontend/.env.production`:

```env
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://primegaming.space
NEXT_PUBLIC_API_URL=https://api.primegaming.space/api
NEXT_PUBLIC_CINETPAY_API_KEY=
NEXT_PUBLIC_CINETPAY_SITE_ID=
```

Puis:

```bash
npm run build
```

## 6. Services systemd

Copier les templates du dossier `deploy/hostinger-vps/systemd/` vers `/etc/systemd/system/`, puis:

```bash
sudo systemctl daemon-reload
sudo systemctl enable primegaming-frontend
sudo systemctl enable primegaming-queue
sudo systemctl enable primegaming-scheduler
sudo systemctl start primegaming-frontend
sudo systemctl start primegaming-queue
sudo systemctl start primegaming-scheduler
```

Vérification:

```bash
sudo systemctl status primegaming-frontend
sudo systemctl status primegaming-queue
sudo systemctl status primegaming-scheduler
```

## 7. Nginx

Copier les templates du dossier `deploy/hostinger-vps/nginx/` vers `/etc/nginx/sites-available/`, puis:

```bash
sudo ln -s /etc/nginx/sites-available/primegaming.space.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/api.primegaming.space.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 8. SSL

Si Certbot est disponible:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d primegaming.space -d www.primegaming.space -d api.primegaming.space
```

Si Hostinger gère le SSL depuis son panneau VPS, active les certificats sur les trois hôtes avant le reload final Nginx.

## 9. Déploiement ultérieur

```bash
cd /var/www/gaming-platform
git pull origin main

cd /var/www/gaming-platform/backend
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache

cd /var/www/gaming-platform/frontend
npm install
npm run build

sudo systemctl restart primegaming-frontend
sudo systemctl restart primegaming-queue
sudo systemctl restart php8.2-fpm
sudo systemctl reload nginx
```

## 10. Contrôles rapides

```bash
curl -I https://primegaming.space
curl https://api.primegaming.space/api/health
sudo journalctl -u primegaming-frontend -n 100 --no-pager
sudo journalctl -u primegaming-queue -n 100 --no-pager
tail -n 100 /var/www/gaming-platform/backend/storage/logs/laravel.log
```

## Notes spécifiques au dépôt

- Le frontend n'est pas un export statique. Il doit tourner via `next start`.
- Le backend utilise `QUEUE_CONNECTION=database`, donc le worker systemd est nécessaire.
- `SANCTUM_STATEFUL_DOMAINS`, `SESSION_DOMAIN` et `SESSION_SECURE_COOKIE` doivent rester cohérents entre frontend et backend.
- Les uploads publics Laravel passent par le disque `public` par défaut; si tu veux une vraie durabilité multi-serveur, passe ensuite sur S3.