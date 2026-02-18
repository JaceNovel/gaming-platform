<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PublicStorageController extends Controller
{
    /**
     * @return array<int, string>
     */
    private function legacyFallbackDisksForPath(string $path): array
    {
        // NOTE: Keep this list intentionally small; this controller serves public files.
        // Dispute evidence is displayed in the UI, so it must remain publicly fetchable.
        if (str_starts_with($path, 'seller-listings/') || str_starts_with($path, 'disputes/') || str_starts_with($path, 'seller-agreements/')) {
            // Older deployments stored files in the local "public" disk (storage/app/public).
            // Some older jobs stored in storage/app (legacy_app) or the current private local disk (storage/app/private).
            return ['public', 'legacy_app', 'local'];
        }

        return [];
    }

    public function show(Request $request, string $path)
    {
        $path = ltrim($path, '/');

        // Basic path traversal guard.
        if ($path === '' || str_contains($path, '..')) {
            return response()->json(['message' => 'Invalid path.'], 400);
        }

        $diskName = (string) (config('filesystems.public_uploads_disk') ?: 'public');
        $disk = Storage::disk($diskName);

        if (!$disk->exists($path)) {
            // Legacy fallback: older deployments stored some public assets on other disks.
            // If we find them, we stream them and best-effort migrate to the configured disk.
            foreach ($this->legacyFallbackDisksForPath($path) as $fallbackDiskName) {
                $fallbackDisk = Storage::disk($fallbackDiskName);
                if (!$fallbackDisk->exists($path)) {
                    continue;
                }

                try {
                    if (!$disk->exists($path)) {
                        $disk->put($path, $fallbackDisk->get($path), [
                            'visibility' => 'public',
                        ]);
                    }
                } catch (\Throwable $e) {
                    // Best-effort: still serve from fallback.
                }

                $resp = $fallbackDisk->response($path);
                $resp->headers->set('Cache-Control', 'public, max-age=86400');
                $resp->headers->set('X-Storage-Source', $fallbackDiskName);
                return $resp;
            }

            return response()->json(['message' => 'File not found.'], 404);
        }

        // If the public uploads disk is S3, redirect to the object URL.
        $driver = (string) (config("filesystems.disks.{$diskName}.driver") ?? '');
        if ($driver === 's3') {
            $url = null;
            try {
                // Works for private buckets too (signed URL). Cache-friendly duration.
                $url = $disk->temporaryUrl($path, now()->addHours(6));
            } catch (\Throwable $e) {
                // Fallback to plain URL for public buckets.
                try {
                    $url = $disk->url($path);
                } catch (\Throwable $e2) {
                    $url = null;
                }
            }

            if (!$url) {
                return response()->json(['message' => 'File not available.'], 404);
            }
            $redirect = redirect()->away($url);
            $redirect->headers->set('Cache-Control', 'public, max-age=86400');
            return $redirect;
        }

        // Storage::response sets content-type based on file extension.
        $resp = $disk->response($path);

        $resp->headers->set('Cache-Control', 'public, max-age=86400');
        return $resp;
    }
}
