import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { reminderId } = await req.json();
    if (!reminderId) return Response.json({ error: 'reminderId is required' }, { status: 400 });

    const reminder = await base44.entities.ScheduledReminder.get(reminderId);
    if (!reminder) return Response.json({ error: 'Reminder not found' }, { status: 404 });
    if (reminder.status === 'sent') return Response.json({ error: 'Reminder already sent' }, { status: 400 });

    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const customer = await base44.entities.Customer.get(reminder.customer_id);

    const messageBody = (reminder.message_body || '')
      .replace(/{{company_name}}/g, customer?.name || 'Valued Customer')
      .replace(/{{contact_person}}/g, customer?.contact_person || 'Sir/Madam')
      .replace(/{{attachments}}/g, '');

    if (reminder.send_type === 'email') {
      if (!reminder.customer_email) {
        return Response.json({ error: 'No email address for this customer' }, { status: 400 });
      }
      await base44.functions.invoke('sendGmailReminder', {
        to: reminder.customer_email,
        subject: reminder.message_subject || 'Payment Reminder',
        body: messageBody,
      });
    }
    // WhatsApp: extend here when API is ready

    await base44.entities.ScheduledReminder.update(reminderId, {
      status: 'sent',
      sent_date: currentDate,
      sent_time: currentTime,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('[sendSingleReminder] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});