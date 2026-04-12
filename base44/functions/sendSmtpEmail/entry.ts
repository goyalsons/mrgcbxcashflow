import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import nodemailer from 'npm:nodemailer@6.9.9';

Deno.serve(async (req) => {
  let smtp, to, subject, body, from_name;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    ({ smtp, to, subject, body, from_name } = await req.json());

    if (!smtp?.host || !smtp?.port || !smtp?.user || !smtp?.password) {
      return Response.json({
        success: false,
        error: 'SMTP configuration is incomplete. Please fill in Host, Port, Username, and Password in Email settings.'
      }, { status: 400 });
    }

    if (!to) {
      return Response.json({ success: false, error: 'Recipient email is required.' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port) || 587,
      secure: Number(smtp.port) === 465,
      auth: {
        user: smtp.user,
        pass: smtp.password,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });

    await transporter.sendMail({
      from: `"${from_name || 'CashFlow Pro'}" <${smtp.user}>`,
      to,
      subject: subject || 'CashFlow Pro — Test Email',
      text: body || `This is a test email from CashFlow Pro sent at ${new Date().toLocaleString('en-IN')}. If you received this, your SMTP settings are working correctly.`,
      html: body ? body.replace(/\n/g, '<br>') : undefined,
    });

    return Response.json({ success: true, message: `Email sent successfully to ${to}` });
  } catch (error) {
    let message = error.message || 'Failed to send email';
    console.error('[sendSmtpEmail] Error:', message);
    if (message.includes('ECONNREFUSED')) message = `Cannot connect to SMTP server. Check Host (${smtp?.host}) and Port (${smtp?.port}). Raw: ${message}`;
    else if (message.includes('EAUTH') || message.includes('535') || message.includes('534')) message = 'Authentication failed — check your Username and Password. For Gmail, use an App Password (not your main password).';
    else if (message.includes('ETIMEDOUT') || message.includes('timeout')) message = `Connection timed out to ${smtp?.host}:${smtp?.port}. Check SMTP Host and Port settings.`;
    else if (message.includes('certificate') || message.includes('SSL') || message.includes('TLS')) message = `SSL/TLS error on port ${smtp?.port}. Try port 587 with STARTTLS or 465 for SSL. Raw: ${message}`;
    else if (message.includes('ENOTFOUND')) message = `SMTP host not found: "${smtp?.host}". Check the hostname spelling.`;
    // Always return 200 so frontend can read the error detail (non-2xx causes axios to throw before reading body)
    return Response.json({ success: false, error: message });
  }
});