import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function buildInvoiceTable(invoices) {
  if (!invoices || invoices.length === 0) return '(No outstanding invoices found)';
  const rows = invoices.map(inv => {
    // Receivable uses amount_received, not amount_paid
    const received = (inv.amount_received || inv.amount_paid || 0);
    const outstanding = (inv.amount || 0) - received;
    const dueDate = inv.due_date ? inv.due_date.split('T')[0] : '-';
    const invDate = inv.invoice_date ? inv.invoice_date.split('T')[0] : '-';
    const overdue = inv.status === 'overdue' ? ' ⚠️ Overdue' : '';
    const amt = outstanding.toLocaleString('en-IN');
    return `  • Inv# ${inv.invoice_number || '-'}  |  Date: ${invDate}  |  Due: ${dueDate}  |  Outstanding: ₹${amt}${overdue}`;
  }).join('\n');
  const total = invoices.reduce((s, i) => s + (i.amount || 0) - (i.amount_received || i.amount_paid || 0), 0);
  return rows + `\n${'─'.repeat(60)}\n  TOTAL OUTSTANDING: ₹${total.toLocaleString('en-IN')}`;
}

function buildAttachmentLinks(invoices) {
  const links = [];
  invoices.forEach(inv => {
    if (inv.attachments) {
      try {
        const arr = JSON.parse(inv.attachments);
        arr.forEach(a => {
          if (a.url) links.push(`  • ${a.name || 'Attachment'} (Inv# ${inv.invoice_number || '-'}): ${a.url}`);
        });
      } catch (e) { /* ignore */ }
    }
    if (inv.document_url && !inv.attachments) {
      links.push(`  • Invoice ${inv.invoice_number || '-'}: ${inv.document_url}`);
    }
  });
  return links.length > 0 ? `Attachments:\n${links.join('\n')}` : '';
}

function buildSignature(companySettings) {
  if (!companySettings) return '';
  const lines = [];
  if (companySettings.contact_person) lines.push(companySettings.contact_person);
  if (companySettings.name) lines.push(companySettings.name);
  if (companySettings.phone) lines.push(`Phone: ${companySettings.phone}`);
  if (companySettings.email) lines.push(`Email: ${companySettings.email}`);
  if (companySettings.website) lines.push(companySettings.website);
  return lines.length > 0 ? `\n\n--\n${lines.join('\n')}` : '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const now = new Date();
    // Use IST (UTC+5:30) since scheduled times are stored in IST
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const currentDate = istNow.toISOString().split('T')[0];
    const currentTime = `${String(istNow.getUTCHours()).padStart(2, '0')}:${String(istNow.getUTCMinutes()).padStart(2, '0')}`;

    // Check if auto reminders are enabled
    try {
      const enabledRecords = await base44.asServiceRole.entities.AppSettings.filter({ key: 'auto_reminders_enabled' });
      if (enabledRecords.length > 0 && enabledRecords[0].value === 'false') {
        return Response.json({ success: true, skipped: true, reason: 'Auto reminders are disabled' });
      }
    } catch (e) { /* if check fails, proceed anyway */ }

    // Fetch company settings for signature (once, shared across all reminders)
    let companySettings = null;
    try {
      const settingsRecords = await base44.entities.AppSettings.filter({ key: 'company_profile' });
      if (settingsRecords.length > 0) {
        companySettings = JSON.parse(settingsRecords[0].value || '{}');
      }
    } catch (e) { /* no settings stored yet */ }

    const signature = buildSignature(companySettings);

    // Fetch all pending scheduled reminders that are due
    const pendingReminders = await base44.entities.ScheduledReminder.filter(
      { status: 'pending' },
      '-created_date',
      1000
    );

    let sentCount = 0;
    let failedCount = 0;

    for (const reminder of pendingReminders) {
      // Check if it's time to send (date must match AND time must have passed)
      const scheduledDate = reminder.scheduled_send_date || '';
      const scheduledTime = reminder.scheduled_send_time || '00:00';
      if (scheduledDate > currentDate) continue;
      if (scheduledDate === currentDate && scheduledTime > currentTime) continue;

      try {
        const customer = await base44.entities.Customer.get(reminder.customer_id);
        let invoices = [];
        if (customer) {
          const allInvoices = await base44.entities.Receivable.filter({ customer_id: reminder.customer_id });
          invoices = allInvoices.filter(i => ['pending', 'overdue', 'partially_paid'].includes(i.status));
          console.log(`[sendScheduledReminders] Found ${invoices.length} outstanding receivables for customer ${customer.name}`);
        }

        const invoiceTable = buildInvoiceTable(invoices);
        const attachmentText = buildAttachmentLinks(invoices);
        const totalOutstanding = invoices.reduce((s, i) => s + (i.amount || 0) - (i.amount_paid || 0), 0);

        // Replace all placeholders in subject
        const subject = (reminder.message_subject || 'Payment Reminder')
          .replace(/\{\{company_name\}\}/g, customer?.name || 'Valued Customer')
          .replace(/\{\{contact_person\}\}/g, customer?.contact_person || 'Sir/Madam');

        // Replace all placeholders in body + append signature
        const messageBody = (reminder.message_body || '')
          .replace(/\{\{company_name\}\}/g, customer?.name || 'Valued Customer')
          .replace(/\{\{contact_person\}\}/g, customer?.contact_person || 'Sir/Madam')
          .replace(/\{\{outstanding_amount\}\}/g, `₹${totalOutstanding.toLocaleString('en-IN')}`)
          .replace(/\{\{invoice_table\}\}/g, invoiceTable)
          .replace(/\{\{attachments\}\}/g, attachmentText || '')
          + signature;

        if (reminder.send_type === 'email') {
          await base44.functions.invoke('sendGmailReminder', {
            to: reminder.customer_email,
            subject,
            body: messageBody,
          });
        }
        // WhatsApp: extend here when API is ready

        await base44.entities.ScheduledReminder.update(reminder.id, {
          status: 'sent',
          sent_date: currentDate,
          sent_time: currentTime,
        });

        // Write success log
        await base44.asServiceRole.entities.ReminderLog.create({
          reminder_id: reminder.id,
          customer_id: reminder.customer_id,
          customer_name: customer?.name || reminder.customer_name || '',
          recipient: reminder.customer_email || reminder.customer_phone || '',
          channel: reminder.send_type || 'email',
          status: 'sent',
          subject: subject || '',
          triggered_by: 'auto',
        });

        sentCount++;
      } catch (e) {
        console.error(`Failed to send reminder ${reminder.id}:`, e.message);
        await base44.entities.ScheduledReminder.update(reminder.id, { status: 'failed' });

        // Write failure log
        try {
          await base44.asServiceRole.entities.ReminderLog.create({
            reminder_id: reminder.id,
            customer_id: reminder.customer_id,
            customer_name: reminder.customer_name || '',
            recipient: reminder.customer_email || reminder.customer_phone || '',
            channel: reminder.send_type || 'email',
            status: 'failed',
            error_message: e.message,
            triggered_by: 'auto',
          });
        } catch (_) { /* don't block on log failure */ }

        failedCount++;
      }
    }

    return Response.json({ success: true, sentCount, failedCount, processedCount: sentCount + failedCount });
  } catch (error) {
    console.error('[sendScheduledReminders] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});