@component('emails.layout', ['title' => $title ?? 'PRIME Gaming', 'logo' => $logo ?? null])
    @if(!empty($headline))
        <h2 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:18px;line-height:22px;color:#111111;">{{ $headline }}</h2>
    @endif

    @if(!empty($intro))
        <p style="margin:0 0 12px 0;font-family:Arial, sans-serif;font-size:14px;line-height:20px;color:#111111;">{{ $intro }}</p>
    @endif

    @if(!empty($details) && is_array($details))
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0;border:1px solid #e5e5e5;background-color:#f7f7f7;">
            <tr>
                <td style="padding:12px;font-family:Arial, sans-serif;font-size:14px;line-height:20px;color:#111111;">
                    @foreach($details as $row)
                        @php
                            $label = is_array($row) ? ($row['label'] ?? null) : null;
                            $value = is_array($row) ? ($row['value'] ?? null) : null;
                        @endphp
                        @if(!empty($label))
                            <div style="margin:0 0 6px 0;"><strong>{{ $label }}:</strong> {{ $value }}</div>
                        @endif
                    @endforeach
                </td>
            </tr>
        </table>
    @endif

    @if(!empty($actionUrl) && !empty($actionText))
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 0 0;">
            <tr>
                <td bgcolor="#ff0000" style="padding:10px 14px;">
                    <a href="{{ $actionUrl }}" style="display:inline-block;font-family:Arial, sans-serif;font-size:14px;line-height:18px;font-weight:bold;color:#ffffff;text-decoration:none;">{{ $actionText }}</a>
                </td>
            </tr>
        </table>
    @endif

    @if(!empty($outro))
        <p style="margin:16px 0 0 0;font-family:Arial, sans-serif;font-size:14px;line-height:20px;color:#111111;">{{ $outro }}</p>
    @endif
@endcomponent
