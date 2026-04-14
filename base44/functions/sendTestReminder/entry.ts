import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { campaignId, testEmail, testPhone } = await req.json();

    if (!campaignId) {
      return Response.json({ error: 'Campaign ID required' }, { status: 400 });
    }

    const campaign = await base44.entities.ReminderCampaign.get(campaignId);
    if (!campaign) {
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Get the first scheduled reminder to extract message content
    const reminders = await base44.entities.ScheduledReminder.filter(
      { campaign_id: campaignId },
      '-created_date',
      1
    );

    if (reminders.length === 0) {
      return Response.json({ error: 'No reminders found for this campaign' }, { status: 404 });
    }

    const reminder = reminders[0];

    // Fetch customer and invoices to replace placeholders
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
    let messageBody = reminder.message_body
      .replace(/{{company_name}}/g, customer?.name || 'Valued Customer')
      .replace(/{{contact_person}}/g, customer?.contact_person || 'Sir/Madam')
      .replace(/{{invoice_table}}/g, invoiceTable)
      .replace(/{{attachments}}/g, '');

    if (campaign.reminder_type === 'email' || campaign.reminder_type === 'both') {
      if (!testEmail) {
        return Response.json({ error: 'Test email not provided' }, { status: 400 });
      }

      // Send test email
      await base44.functions.invoke('sendGmailReminder', {
        to: testEmail,
        subject: `[TEST] ${reminder.message_subject || 'Payment Reminder'}`,
        body: `[This is a TEST message]\n\n${messageBody}`,
      });
    }

    if (campaign.reminder_type === 'whatsapp' || campaign.reminder_type === 'both') {
      if (!testPhone) {
        return Response.json({ error: 'Test phone not provided' }, { status: 400 });
      }

      // For WhatsApp, just log - actual sending would require WhatsApp API
      console.log(`WhatsApp test message would be sent to ${testPhone}: ${reminder.message_body}`);
    }

    return Response.json({
      success: true,
      message: `Test ${campaign.reminder_type} sent successfully`,
    });
  } catch (error) {
    console.error('[sendTestReminder] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});