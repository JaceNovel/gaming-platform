<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\IpUtils;

class ImageProxyController extends Controller
{
    public function show(Request $request)
    {
        $rawUrl = trim((string) $request->query('url', ''));
        if ($rawUrl === '') {
            return response()->json(['message' => 'Missing url'], 400);
        }

        $parts = parse_url($rawUrl);
        if (!is_array($parts)) {
            return response()->json(['message' => 'Invalid url'], 400);
        }

        $scheme = strtolower((string)($parts['scheme'] ?? ''));
        if (!in_array($scheme, ['http', 'https'], true)) {
            return response()->json(['message' => 'Unsupported scheme'], 400);
        }

        $host = (string)($parts['host'] ?? '');
        if ($host === '' || strtolower($host) === 'localhost') {
            return response()->json(['message' => 'Invalid host'], 400);
        }

        // SSRF protection: block private/reserved ranges.
        $blockedCidrs = [
            '0.0.0.0/8',
            '10.0.0.0/8',
            '100.64.0.0/10',
            '127.0.0.0/8',
            '169.254.0.0/16',
            '172.16.0.0/12',
            '192.0.0.0/24',
            '192.0.2.0/24',
            '192.168.0.0/16',
            '198.18.0.0/15',
            '198.51.100.0/24',
            '203.0.113.0/24',
            '224.0.0.0/4',
            '240.0.0.0/4',
            '::/128',
            '::1/128',
            'fc00::/7',
            'fe80::/10',
        ];

        $ips = [];
        $records = @dns_get_record($host, DNS_A + DNS_AAAA);
        if (is_array($records)) {
            foreach ($records as $rec) {
                if (!empty($rec['ip'])) $ips[] = $rec['ip'];
                if (!empty($rec['ipv6'])) $ips[] = $rec['ipv6'];
            }
        }
        if (empty($ips)) {
            $fallback = @gethostbynamel($host);
            if (is_array($fallback)) {
                $ips = array_merge($ips, $fallback);
            }
        }

        foreach ($ips as $ip) {
            if (IpUtils::checkIp($ip, $blockedCidrs)) {
                return response()->json(['message' => 'Blocked host'], 400);
            }
        }

        try {
            $resp = Http::timeout(10)
                ->connectTimeout(5)
                ->withOptions([
                    'allow_redirects' => ['max' => 3, 'strict' => true],
                    'verify' => true,
                ])
                ->withHeaders([
                    'User-Agent' => 'BADBOYSHOP/1.0 (+image-proxy)',
                    'Accept' => 'image/*,*/*;q=0.8',
                ])
                ->get($rawUrl);

            if (!$resp->ok()) {
                return response()->json([
                    'message' => 'Upstream error',
                    'status' => $resp->status(),
                ], 502);
            }

            $contentType = (string)($resp->header('Content-Type') ?? '');
            $contentType = trim(explode(';', $contentType)[0]);
            if ($contentType === '' || stripos($contentType, 'image/') !== 0) {
                return response()->json([
                    'message' => 'Upstream is not an image',
                    'content_type' => $contentType,
                ], 415);
            }

            $body = $resp->body();

            // Basic size guard (10MB)
            if (strlen($body) > 10 * 1024 * 1024) {
                return response()->json(['message' => 'Image too large'], 413);
            }

            return response($body, 200)
                ->header('Content-Type', $contentType)
                ->header('Cache-Control', 'public, max-age=86400')
                ->header('X-Content-Type-Options', 'nosniff');
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Proxy error',
            ], 502);
        }
    }
}
