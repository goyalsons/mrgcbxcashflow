import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get current time
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Fetch all pending scheduled reminders
    const pendingReminders = await base44.entities.ScheduledReminder.filter(
      { status: 'pending' },
      '-created_date',
      1000
    );

    let sentCount = 0;
    let failedCount = 0;

    for (const reminder of pendingReminders) {
      // Check if it's time to send
      if (reminder.scheduled_send_date !== currentDate || reminder.scheduled_send_time > currentTime) {
        continue; // Not yet time to send
      }

      try {
        // Fetch customer and receivables to replace placeholders
        const customer = await base44.entities.Customer.get(reminder.customer_id);
        let receivables = [];
        if (customer) {
          receivables = await base44.entities.Receivable.filter({ customer_id: reminder.customer_id });
        }

        // Build invoice table HTML
        const invoiceTable = receivables.length > 0
          ? `<table style="border-collapse:collapse;width:100%;margin:10px 0;">
              <tr style="background:#f5f5f5;">
                <th style="border:1px solid #ddd;padding:8px;text-align:left;">Invoice #</th>
                <th style="border:1px solid #ddd;padding:8px;text-align:right;">Amount</th>
                <th style="border:1px solid #ddd;padding:8px;text-align:left;">Due Date</th>
              </tr>
              ${receivables.map(r => `<tr>
                <td style="border:1px solid #ddd;padding:8px;">${r.invoice_number || 'N/A'}</td>
                <td style="border:1px solid #ddd;padding:8px;text-align:right;">₹${(r.amount || 0).toLocaleString('en-IN')}</td>
                <td style="border:1px solid #ddd;padding:8px;">${r.due_date || 'N/A'}</td>
              </tr>`).join('')}
            </table>`
          : '<p style="color:#999;">No outstanding receivables found.</p>';

        // Replace placeholders in message body
        const messageBody = reminder.message_body
          .replace(/{{company_name}}/g, customer?.name || 'Valued Customer')
          .replace(/{{contact_person}}/g, customer?.contact_person || 'Sir/Madam')
          .replace(/{{invoice_table}}/g, invoiceTable)
          .replace(/{{attachments}}/g, '');

        if (reminder.send_type === 'email') {
          // Send via Gmail
          await base44.functions.invoke('sendSmtpEmail', {
            to: reminder.debtor_email,
            subject: reminder.message_subject || 'Payment Reminder',
            body: messageBody,
            from_name: 'Payment Reminders',
          });
        } else if (reminder.send_type === 'whatsapp') {
          // Send via WhatsApp
          // Note: This would require WhatsApp API setup - for now just mark as sent
          // In production, integrate with WhatsApp Business API
        }

        // Mark as sent
        await base44.entities.ScheduledReminder.update(reminder.id, {
          status: 'sent',
          sent_date: currentDate,
          sent_time: currentTime,
        });

        sentCount++;
      } catch (e) {
        console.error(`Failed to send reminder ${reminder.id}:`, e.message);
        // Mark as failed
        await base44.entities.ScheduledReminder.update(reminder.id, {
          status: 'failed',
        });
        failedCount++;
      }
    }

    return Response.json({
      success: true,
      sentCount,
      failedCount,
      processedCount: sentCount + failedCount,
    });
  } catch (error) {
    console.error('[sendScheduledReminders] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});