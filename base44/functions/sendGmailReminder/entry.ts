import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { to, subject, body } = await req.json();
    if (!to || !subject || !body) return Response.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Encode subject as RFC 2047 encoded-word to handle non-ASCII chars
    const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;

    // Build RFC 2822 email message
    const messageParts = [
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      body,
    ];
    // Encode full message as UTF-8 bytes → base64
    const uint8 = new TextEncoder().encode(messageParts.join('\r\n'));
    let binary = '';
    uint8.forEach(b => { binary += String.fromCharCode(b); });
    const raw = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
      const err = await res.json();
      return Response.json({ error: err?.error?.message || 'Gmail send failed' }, { status: res.status });
    }

    const data = await res.json();
    return Response.json({ success: true, messageId: data.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});