<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $title ?? 'BADBOYSHOP' }}</title>
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
<body>
    <div class="container">
        <div class="header">
            @if($logo)
                <img src="{{ $logo }}" alt="BADBOYSHOP Logo" class="logo">
            @else
                <h1 style="color: #ffffff; margin: 0;">BADBOYSHOP</h1>
            @endif
        </div>
        <div class="content">
            {{ $slot }}
        </div>
        <div class="footer">
            <p>© 2026 BADBOYSHOP. Tous droits réservés.</p>
            <p>Si vous avez des questions, contactez-nous sur WhatsApp : +228 93 97 06 11</p>
        </div>
    </div>
</body>
</html>