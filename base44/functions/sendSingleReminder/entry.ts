import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function buildInvoiceTable(invoices) {
  if (!invoices || invoices.length === 0) return '';
  const rows = invoices.map(inv => {
    const outstanding = (inv.amount || 0) - (inv.amount_paid || 0);
    const dueDate = inv.due_date ? inv.due_date.split('T')[0] : '-';
    const invDate = inv.invoice_date ? inv.invoice_date.split('T')[0] : '-';
    const overdue = inv.status === 'overdue' ? ' ⚠️ Overdue' : '';
    const amt = outstanding.toLocaleString('en-IN');
    return `  • Inv# ${inv.invoice_number || '-'}  |  Date: ${invDate}  |  Due: ${dueDate}  |  Outstanding: ₹${amt}${overdue}`;
  }).join('\n');
  const total = invoices.reduce((s, i) => s + (i.amount || 0) - (i.amount_paid || 0), 0);
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

    const { reminderId } = await req.json();
    if (!reminderId) return Response.json({ error: 'reminderId is required' }, { status: 400 });

    const reminder = await base44.entities.ScheduledReminder.get(reminderId);
    if (!reminder) return Response.json({ error: 'Reminder not found' }, { status: 404 });
    if (reminder.status === 'sent') return Response.json({ error: 'Reminder already sent' }, { status: 400 });

    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Fetch customer and their outstanding invoices
    const customer = await base44.entities.Customer.get(reminder.customer_id);
    let invoices = [];
    if (customer) {
      const allInvoices = await base44.entities.Invoice.filter({ debtor_id: reminder.customer_id });
      invoices = allInvoices.filter(i => ['pending', 'overdue', 'partial'].includes(i.status));
    }

    // Fetch company settings for signature
    let companySettings = null;
    try {
      const settingsRecords = await base44.entities.AppSettings.filter({ key: 'company_profile' });
      if (settingsRecords.length > 0) {
        companySettings = JSON.parse(settingsRecords[0].value || '{}');
      }
    } catch (e) { /* no settings stored yet */ }

    const invoiceTable = buildInvoiceTable(invoices);
    const attachmentText = buildAttachmentLinks(invoices);
    const totalOutstanding = invoices.reduce((s, i) => s + (i.amount || 0) - (i.amount_paid || 0), 0);
    const signature = buildSignature(companySettings);

    // Replace all placeholders in subject
    const subject = (reminder.message_subject || 'Payment Reminder')
      .replace(/\{\{company_name\}\}/g, customer?.name || 'Valued Customer')
      .replace(/\{\{contact_person\}\}/g, customer?.contact_person || 'Sir/Madam');

    // Replace all placeholders in body
    const messageBody = (reminder.message_body || '')
      .replace(/\{\{company_name\}\}/g, customer?.name || 'Valued Customer')
      .replace(/\{\{contact_person\}\}/g, customer?.contact_person || 'Sir/Madam')
      .replace(/\{\{outstanding_amount\}\}/g, `₹${totalOutstanding.toLocaleString('en-IN')}`)
      .replace(/\{\{invoice_table\}\}/g, invoiceTable)
      .replace(/\{\{attachments\}\}/g, attachmentText ? attachmentText : '')
      + signature;

    if (reminder.send_type === 'email') {
      if (!reminder.customer_email) {
        return Response.json({ error: 'No email address for this customer' }, { status: 400 });
      }
      await base44.functions.invoke('sendGmailReminder', {
        to: reminder.customer_email,
        subject,
        body: messageBody,
      });
    }
    // WhatsApp: extend here when API is ready

    await base44.entities.ScheduledReminder.update(reminderId, {
      status: 'sent',
      sent_date: currentDate,
      sent_time: currentTime,
    });

    // Write success log
    await base44.asServiceRole.entities.ReminderLog.create({
      reminder_id: reminderId,
      customer_id: reminder.customer_id,
      customer_name: customer?.name || reminder.customer_name || '',
      recipient: reminder.customer_email || reminder.customer_phone || '',
      channel: reminder.send_type || 'email',
      status: 'sent',
      subject: subject || '',
      triggered_by: 'manual',
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('[sendSingleReminder] Error:', error);

    // Write failure log
    try {
      const base44Log = createClientFromRequest(req);
      await base44Log.asServiceRole.entities.ReminderLog.create({
        reminder_id: reminderId || '',
        customer_name: '',
        channel: 'email',
        status: 'failed',
        error_message: error.message,
        triggered_by: 'manual',
      });
    } catch (_) { /* don't block on log failure */ }

    return Response.json({ error: error.message }, { status: 500 });
  }
});