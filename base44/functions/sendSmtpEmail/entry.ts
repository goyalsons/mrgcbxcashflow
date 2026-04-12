import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import nodemailer from 'npm:nodemailer@6.9.9';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { smtp, to, subject, body, from_name } = await req.json();

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
    if (message.includes('ECONNREFUSED')) message = `Cannot connect to SMTP server (${message}). Check your Host and Port.`;
    else if (message.includes('EAUTH') || message.includes('535') || message.includes('534')) message = 'Authentication failed. Check your Username and Password (use App Password for Gmail).';
    else if (message.includes('ETIMEDOUT') || message.includes('timeout')) message = 'Connection timed out. Check your SMTP Host and Port.';
    else if (message.includes('certificate')) message = 'SSL certificate error. Try port 587 instead of 465.';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
});