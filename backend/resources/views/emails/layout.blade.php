<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark light">
    <meta name="supported-color-schemes" content="dark light">
    <title>{{ $title ?? 'PRIME Gaming' }}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: 'Arial', sans-serif;
            background-color: #121212;
            color: #ffffff;
            line-height: 1.6;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #1e1e1e;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
        }
        .header {
            background: linear-gradient(135deg, #ff0000, #000000);
            padding: 20px;
            text-align: center;
        }
        .logo {
            max-width: 150px;
            height: auto;
        }
        .content {
            padding: 30px;
        }
        .footer {
            background-color: #2a2a2a;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #cccccc;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #ff0000, #000000);
            color: #ffffff;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px 0;
            font-weight: bold;
        }
        .highlight {
            background-color: #333333;
            padding: 15px;
            border-left: 4px solid #ff0000;
            margin: 20px 0;
        }
        @media (max-width: 600px) {
            .container {
                margin: 10px;
                border-radius: 5px;
            }
            .content {
                padding: 20px;
            }
            .header {
                padding: 15px;
            }
        }
    </style>
</head>
<body bgcolor="#121212" style="margin:0;padding:0;font-family:Arial, sans-serif;background-color:#121212;color:#ffffff;line-height:1.6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#121212" style="background-color:#121212;">
        <tr>
            <td align="center" style="padding:0;margin:0;">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#1e1e1e" style="max-width:600px;width:100%;background-color:#1e1e1e;border-radius:10px;overflow:hidden;">
                    <tr>
                        <td bgcolor="#000000" style="background-color:#000000;background:linear-gradient(135deg,#ff0000,#000000);padding:20px;text-align:center;">
                            @if(!empty($logo))
                                <img src="{{ $logo }}" alt="PRIME Gaming Logo" style="max-width:150px;height:auto;display:inline-block;" />
                            @else
                                <h1 style="color:#ffffff;margin:0;">PRIME Gaming</h1>
                            @endif
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:30px;color:#ffffff;font-family:Arial, sans-serif;">
                            <div style="color:#ffffff;">
                                {{ $slot }}
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td bgcolor="#2a2a2a" style="background-color:#2a2a2a;padding:20px;text-align:center;font-size:12px;color:#cccccc;font-family:Arial, sans-serif;">
                            <p style="margin:0 0 6px 0;color:#cccccc;">© 2026 PRIME Gaming. Tous droits réservés.</p>
                            <p style="margin:0;color:#cccccc;">Si vous avez des questions, contactez-nous sur WhatsApp : +228 93 97 06 11</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>