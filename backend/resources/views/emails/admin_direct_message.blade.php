@component('emails.layout', ['title' => ($subjectLine ?? 'Message'), 'logo' => ($logo ?? null)])
  <h2 style="margin:0 0 10px 0;font-family:Arial, sans-serif;font-size:18px;line-height:22px;color:#111111;">{{ $subjectLine ?? 'Message' }}</h2>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0;border:1px solid #e5e5e5;background-color:#f7f7f7;">
    <tr>
      <td style="padding:12px;font-family:Arial, sans-serif;font-size:14px;line-height:20px;color:#111111;">
        {!! nl2br(e($messageBody ?? '')) !!}
      </td>
    </tr>
  </table>
  @if(!empty($adminName))
    <p style="margin:16px 0 0 0;color:#666666;font-size:13px;line-height:18px;">Envoyé par : {{ $adminName }}</p>
  @endif
@endcomponent
