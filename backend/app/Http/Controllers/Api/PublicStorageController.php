<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PublicStorageController extends Controller
{
    private function isAllowedLegacyFallbackPath(string $path): bool
    {
        // Only allow fallbacks for assets that are meant to be publicly visible.
        // Do NOT add sensitive prefixes here (e.g. KYC).
        return str_starts_with($path, 'seller-listings/');
    }

    public function show(Request $request, string $path)
    {
        $path = ltrim($path, '/');

        // Basic path traversal guard.
        if ($path === '' || str_contains($path, '..')) {
            return response()->json(['message' => 'Invalid path.'], 400);
        }

        $disk = Storage::disk('public');

        if (!$disk->exists($path)) {
            // Legacy fallback: older deployments stored some public assets on the local disk.
            // If we find them, we stream them and best-effort migrate to the public disk.
            if ($this->isAllowedLegacyFallbackPath($path)) {
                $local = Storage::disk('local');
                if ($local->exists($path)) {
                    try {
                        if (!$disk->exists($path)) {
                            $disk->put($path, $local->get($path));
                        }
                    } catch (\Throwable $e) {
                        // Best-effort: still serve from local.
                    }

                    $resp = $local->response($path);
                    return $resp
                        ->header('Cache-Control', 'public, max-age=86400')
                        ->header('X-Storage-Source', 'local');
                }
            }

            return response()->json(['message' => 'File not found.'], 404);
        }

        // Storage::response sets content-type based on file extension.
        $resp = $disk->response($path);

        return $resp->header('Cache-Control', 'public, max-age=86400');
    }
}
