@component('emails.layout', ['title' => ($subjectLine ?? 'Message'), 'logo' => ($logo ?? null)])
  <h2 style="margin:0 0 10px 0; color:#ffffff;">{{ $subjectLine ?? 'Message' }}</h2>
  <div class="highlight">
      {!! nl2br(e($messageBody ?? '')) !!}
  </div>
  @if(!empty($adminName))
      <p style="margin:16px 0 0 0; color:#cccccc; font-size:13px;">Envoyé par : {{ $adminName }}</p>
  @endif
@endcomponent
