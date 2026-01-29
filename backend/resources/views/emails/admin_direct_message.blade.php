<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $subjectLine ?? 'Message - BADBOYSHOP' }}</title>
</head>
<body style="margin:0;padding:0;font-family:Arial, sans-serif;background:#121212;color:#ffffff;line-height:1.6;">
    <div style="max-width:600px;margin:0 auto;background:#1e1e1e;border-radius:10px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#ff0000,#000000);padding:20px;text-align:center;">
            @if(!empty($logo))
                <img src="{{ $logo }}" alt="BADBOYSHOP" style="max-width:150px;height:auto;">
            @else
                <h1 style="color:#ffffff;margin:0;">BADBOYSHOP</h1>
            @endif
        </div>

        <div style="padding:26px;">
            <h2 style="margin:0 0 14px 0;font-size:18px;">{{ $subjectLine ?? 'Message' }}</h2>

            <div style="background:#2a2a2a;border-left:4px solid #ff0000;padding:14px 16px;margin:16px 0;border-radius:6px;">
                {!! nl2br(e($messageBody ?? '')) !!}
            </div>

            @if(!empty($adminName))
                <p style="margin:18px 0 0 0;color:#cccccc;font-size:13px;">Envoyé par : {{ $adminName }}</p>
            @endif

            <p style="margin:18px 0 0 0;color:#cccccc;font-size:12px;">Besoin d'aide ? Contactez-nous sur WhatsApp : +228 93 97 06 11</p>
        </div>

        <div style="background:#2a2a2a;padding:16px;text-align:center;font-size:12px;color:#cccccc;">
            <p style="margin:0;">© 2026 BADBOYSHOP</p>
        </div>
    </div>
</body>
</html>
