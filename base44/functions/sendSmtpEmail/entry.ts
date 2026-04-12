import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Encode email as base64url per Gmail API requirements
function makeRFC2822(to, from_name, from_email, subject, body) {
  const msg = [
    `From: "${from_name}" <${from_email}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    body.replace(/\n/g, '<br>'),
  ].join('\r\n');

  return btoa(unescape(encodeURIComponent(msg)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { to, subject, body, from_name } = await req.json();

    if (!to) return Response.json({ success: false, error: 'Recipient email is required.' });

    // Get Gmail OAuth access token (shared connector)
    let accessToken, senderEmail;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('gmail');
      accessToken = conn.accessToken;
      // Fetch sender's email address
      const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const profile = await profileRes.json();
      senderEmail = profile.emailAddress;
    } catch {
      return Response.json({
        success: false,
        error: 'Gmail is not connected. Please connect your Gmail account in Settings → Email.'
      });
    }

    const raw = makeRFC2822(to, from_name || 'CashFlow Pro', senderEmail, subject, body);

    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!sendRes.ok) {
      const err = await sendRes.json();
      return Response.json({ success: false, error: err.error?.message || 'Failed to send email via Gmail.' });
    }

    return Response.json({ success: true, message: `Email sent successfully to ${to} via Gmail.` });
  } catch (error) {
    console.error('[sendSmtpEmail] Error:', error.message);
    return Response.json({ success: false, error: error.message });
  }
});