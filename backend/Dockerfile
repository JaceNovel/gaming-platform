# syntax=docker/dockerfile:1

FROM composer:2.7.7 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --prefer-dist --no-interaction --no-progress --optimize-autoloader --no-scripts

FROM php:8.2-cli AS runtime
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends git unzip libzip-dev libpng-dev libonig-dev libpq-dev \
    && docker-php-ext-install pdo_mysql pdo_pgsql mbstring zip \
    && rm -rf /var/lib/apt/lists/*

# Ensure file uploads work reliably in production (Render) when using the PHP built-in server.
# Without this, PHP defaults can silently drop uploaded files, causing image_path to remain null.
RUN { \
            echo "file_uploads=On"; \
            echo "upload_max_filesize=10M"; \
            echo "post_max_size=12M"; \
            echo "max_file_uploads=20"; \
        } > /usr/local/etc/php/conf.d/uploads.ini

COPY . /app
COPY --from=vendor /app/vendor /app/vendor

RUN chmod -R 775 storage bootstrap/cache

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV APP_ENV=production
EXPOSE 10000

ENTRYPOINT ["docker-entrypoint.sh"]
