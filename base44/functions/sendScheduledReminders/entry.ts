import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function sendViaGmail(base44, to, subject, body) {
  const conn = await base44.asServiceRole.connectors.getConnection('gmail');
  if (!conn || !conn.accessToken) throw new Error('Gmail not authorized');
  const accessToken = conn.accessToken;

  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const htmlBody = body
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>\n');
  const messageParts = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    `<html><body style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222;">${htmlBody}</body></html>`,
  ];
  const uint8 = new TextEncoder().encode(messageParts.join('\r\n'));
  let binary = '';
  uint8.forEach(b => { binary += String.fromCharCode(b); });
  const raw = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || 'Gmail send failed');
  }
  return await res.json();
}

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
    if (inv.document_url) {
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

/**
 * Given a sent date and campaign frequency, calculate the next send date.
 * frequency: 'daily' | 'weekly' | 'monthly'
 */
function calcNextDate(sentDateStr, frequency) {
  if (!sentDateStr || !frequency) return null;
  const d = new Date(sentDateStr);
  if (isNaN(d.getTime())) return null;
  if (frequency === 'daily') {
    d.setDate(d.getDate() + 1);
  } else if (frequency === 'weekly') {
    d.setDate(d.getDate() + 7);
  } else if (frequency === 'monthly') {
    d.setMonth(d.getMonth() + 1);
  } else {
    return null;
  }
  return d.toISOString().split('T')[0];
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
    const pendingReminders = await base44.asServiceRole.entities.ScheduledReminder.filter(
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
          // First try matching by customer_id
          let allInvoices = await base44.entities.Receivable.filter({ customer_id: reminder.customer_id });
          // Fallback: match by customer_name (for CSV-imported receivables with no customer_id)
          if (allInvoices.length === 0 && customer.name) {
            allInvoices = await base44.entities.Receivable.filter({ customer_name: customer.name });
          }
          invoices = allInvoices.filter(i => ['pending', 'overdue', 'partially_paid'].includes(i.status));
          console.log(`[sendScheduledReminders] Found ${invoices.length} outstanding receivables for customer ${customer.name}`);
        }

        const invoiceTable = buildInvoiceTable(invoices);
        const attachmentText = buildAttachmentLinks(invoices);
        const totalOutstanding = invoices.reduce((s, i) => s + (i.amount || 0) - (i.amount_received || i.amount_paid || 0), 0);

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
          await sendViaGmail(base44, reminder.customer_email, subject, messageBody);
        }
        // WhatsApp: extend here when API is ready

        await base44.asServiceRole.entities.ScheduledReminder.update(reminder.id, {
          status: 'sent',
          sent_date: currentDate,
          sent_time: currentTime,
        });

        // Schedule next reminder in the recurring series
        if (reminder.campaign_id) {
          try {
            const campaign = await base44.asServiceRole.entities.ReminderCampaign.get(reminder.campaign_id);
            if (campaign && campaign.status === 'active') {
              const nextDate = calcNextDate(reminder.scheduled_send_date, campaign.frequency);
              if (nextDate) {
                await base44.asServiceRole.entities.ScheduledReminder.create({
                  campaign_id: reminder.campaign_id,
                  customer_id: reminder.customer_id,
                  customer_email: reminder.customer_email,
                  customer_phone: reminder.customer_phone,
                  message_subject: reminder.message_subject,
                  message_body: reminder.message_body,
                  scheduled_send_date: nextDate,
                  scheduled_send_time: reminder.scheduled_send_time || '09:00',
                  status: 'pending',
                  send_type: reminder.send_type,
                  reminder_number: (reminder.reminder_number || 1) + 1,
                });
                // Update campaign next_send_date and last_sent_date
                await base44.asServiceRole.entities.ReminderCampaign.update(campaign.id, {
                  last_sent_date: currentDate,
                  next_send_date: nextDate,
                });
                console.log(`[sendScheduledReminders] Scheduled next reminder for campaign ${campaign.id} on ${nextDate}`);
              }
            }
          } catch (schedErr) {
            console.warn(`[sendScheduledReminders] Could not schedule next reminder for campaign ${reminder.campaign_id}:`, schedErr.message);
          }
        }

        // Write success log
        try {
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
        } catch (_) { /* don't block on log failure */ }

        sentCount++;
      } catch (e) {
        console.error(`Failed to send reminder ${reminder.id}:`, e.message);
        await base44.asServiceRole.entities.ScheduledReminder.update(reminder.id, { status: 'failed' });

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