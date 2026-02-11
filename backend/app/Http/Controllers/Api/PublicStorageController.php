<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PublicStorageController extends Controller
{
    public function show(Request $request, string $path)
    {
        $path = ltrim($path, '/');

        // Basic path traversal guard.
        if ($path === '' || str_contains($path, '..')) {
            return response()->json(['message' => 'Invalid path.'], 400);
        }

        $disk = Storage::disk('public');

        if (!$disk->exists($path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        // Storage::response sets content-type based on file extension.
        $resp = $disk->response($path);

        return $resp->header('Cache-Control', 'public, max-age=86400');
    }
}
