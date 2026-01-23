<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AdminSettingsController extends Controller
{
    public function show()
    {
        return response()->json([
            'logo_url' => $this->getSetting('logo_url'),
            'whatsapp_number' => $this->getSetting('whatsapp_number'),
            'terms' => $this->getSetting('terms'),
        ]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'whatsapp_number' => 'nullable|string|max:30',
            'terms' => 'nullable|string',
        ]);

        if (array_key_exists('whatsapp_number', $data)) {
            $this->saveSetting('whatsapp_number', $data['whatsapp_number']);
        }

        if (array_key_exists('terms', $data)) {
            $this->saveSetting('terms', $data['terms']);
        }

        return $this->show();
    }

    public function uploadLogo(Request $request)
    {
        $request->validate([
            'logo' => 'required|image|max:2048',
        ]);

        $path = $request->file('logo')->store('logos', 'public');
        $url = Storage::url($path);

        $this->saveSetting('logo_url', $url);

        return response()->json(['logo_url' => $url]);
    }

    private function saveSetting(string $key, ?string $value): void
    {
        SiteSetting::updateOrCreate(['key' => $key], ['value' => $value]);
    }

    private function getSetting(string $key): ?string
    {
        return optional(SiteSetting::where('key', $key)->first())->value;
    }
}
