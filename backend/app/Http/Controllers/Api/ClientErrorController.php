<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ClientErrorController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'message' => 'required|string|max:2000',
            'digest' => 'nullable|string|max:255',
            'path' => 'nullable|string|max:255',
            'user_agent' => 'nullable|string|max:512',
            'context' => 'nullable|array',
        ]);

        Log::warning('client_error', [
            'message' => $data['message'],
            'digest' => $data['digest'] ?? null,
            'path' => $data['path'] ?? null,
            'user_agent' => $data['user_agent'] ?? $request->userAgent(),
            'ip' => $request->ip(),
            'context' => $data['context'] ?? null,
        ]);

        return response()->json(['ok' => true]);
    }
}
