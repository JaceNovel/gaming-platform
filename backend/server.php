<?php

// Router script for PHP's built-in server.
// Ensures all non-static requests are routed to Laravel's public/index.php.

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');

// Serve existing files directly.
if ($uri !== '/' && file_exists(__DIR__ . '/public' . $uri)) {
    return false;
}

require __DIR__ . '/public/index.php';
