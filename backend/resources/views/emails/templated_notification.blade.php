@component('emails.layout', ['title' => $title ?? 'PRIME Gaming', 'logo' => $logo ?? null])
    @if(!empty($headline))
        <h2 style="margin: 0 0 10px 0;">{{ $headline }}</h2>
    @endif

    @if(!empty($intro))
        <p style="margin: 0 0 12px 0;">{{ $intro }}</p>
    @endif

    @if(!empty($details) && is_array($details))
        <div class="highlight">
            @foreach($details as $row)
                @php
                    $label = is_array($row) ? ($row['label'] ?? null) : null;
                    $value = is_array($row) ? ($row['value'] ?? null) : null;
                @endphp
                @if(!empty($label))
                    <div><strong>{{ $label }}:</strong> {{ $value }}</div>
                @endif
            @endforeach
        </div>
    @endif

    @if(!empty($actionUrl) && !empty($actionText))
        <p style="margin: 14px 0 0 0;">
            <a class="button" href="{{ $actionUrl }}">{{ $actionText }}</a>
        </p>
    @endif

    @if(!empty($outro))
        <p style="margin: 16px 0 0 0;">{{ $outro }}</p>
    @endif
@endcomponent
