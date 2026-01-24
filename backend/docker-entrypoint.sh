#!/usr/bin/env sh
set -e

php artisan config:cache
php artisan route:cache
php artisan view:cache

HOST=0.0.0.0
PORT=${PORT:-10000}

exec php -S "$HOST:$PORT" -t public
