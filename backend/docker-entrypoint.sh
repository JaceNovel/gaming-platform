#!/usr/bin/env sh
set -e

php artisan config:cache
php artisan route:cache
php artisan view:cache

# Ensure public files (e.g. product uploads) are accessible via /storage/...
php artisan storage:link || true

ROLE=${CONTAINER_ROLE:-web}

if [ "${RUN_MIGRATIONS:-0}" = "1" ] && [ "$ROLE" = "web" ]; then
	php artisan migrate --force
fi

if [ "$ROLE" = "worker" ]; then
	exec php artisan queue:work --queue=redeem-fulfillment,default --sleep=3 --tries=3 --timeout=120
fi

HOST=0.0.0.0
PORT=${PORT:-10000}

exec php -S "$HOST:$PORT" -t public
