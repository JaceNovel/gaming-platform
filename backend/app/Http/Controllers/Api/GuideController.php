<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Storage;

class GuideController extends Controller
{
    public function shop2gameFreeFire()
    {
        $path = 'guides/shop2game-freefire.pdf';
        $disk = Storage::disk('public');

        if (!$disk->exists($path)) {
            return response()->json(['message' => 'Guide not found'], 404);
        }

        return response()->file($disk->path($path));
    }
}
