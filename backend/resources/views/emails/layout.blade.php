<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $title ?? 'PRIME Gaming' }}</title>
</head>
<body style="margin:0;padding:0;background-color:#f2f2f2;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f2f2;">
        <tr>
            <td align="center" style="padding:24px 12px;">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #e5e5e5;">
                    <tr>
                        <td align="center" style="padding:18px 16px;background-color:#111111;">
                            @if(!empty($logo))
                                <img src="{{ $logo }}" alt="PRIME Gaming" width="150" style="display:block;max-width:150px;height:auto;border:0;outline:none;text-decoration:none;" />
                            @else
                                <div style="font-family:Arial, sans-serif;font-size:20px;line-height:24px;font-weight:bold;color:#ffffff;">PRIME Gaming</div>
                            @endif
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:22px 18px;font-family:Arial, sans-serif;font-size:14px;line-height:20px;color:#111111;">
                            {{ $slot }}
                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="padding:16px 18px;background-color:#f7f7f7;font-family:Arial, sans-serif;font-size:12px;line-height:18px;color:#666666;">
                            <div>© 2026 PRIME Gaming. Tous droits réservés.</div>
                            <div>Support WhatsApp : +228 93 97 06 11</div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>