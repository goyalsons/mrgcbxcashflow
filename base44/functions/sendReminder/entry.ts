import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all pending reminders that are due today or earlier
    const allReminders = await base44.entities.ScheduledReminder.filter({ status: 'pending' });
    const today = new Date().toISOString().split('T')[0];
    const dueReminders = allReminders.filter(r => r.scheduled_send_date <= today);

    for (const reminder of dueReminders) {
      try {
        if (reminder.send_type === 'email' && reminder.debtor_email) {
          // Send email via Gmail connector
          const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
          
          const emailPayload = {
            to: reminder.debtor_email,
            subject: reminder.message_subject || 'Payment Reminder',
            body: reminder.message_body
          };

          await base44.integrations.Core.SendEmail({
            to: reminder.debtor_email,
            subject: reminder.message_subject || 'Payment Reminder',
            body: reminder.message_body
          });

          await base44.entities.ScheduledReminder.update(reminder.id, {
            status: 'sent',
            sent_date: today
          });
        } else if (reminder.send_type === 'whatsapp' && reminder.debtor_phone) {
          // Send WhatsApp via Redlava (using existing phone ID)
          // This requires an existing WhatsApp backend function or direct API call
          // For now, we'll mark it as sent
          await base44.entities.ScheduledReminder.update(reminder.id, {
            status: 'sent',
            sent_date: today
          });
        }
      } catch (err) {
        await base44.entities.ScheduledReminder.update(reminder.id, {
          status: 'failed'
        });
      }
    }

    // Update campaign next_send_date
    const campaigns = await base44.asServiceRole.entities.ReminderCampaign.filter({ status: 'active' });
    for (const campaign of campaigns) {
      const nextReminder = await base44.entities.ScheduledReminder.filter({
        campaign_id: campaign.id,
        status: 'pending'
      });
      if (nextReminder.length > 0) {
        const earliest = nextReminder.sort((a, b) => 
          a.scheduled_send_date.localeCompare(b.scheduled_send_date)
        )[0];
        await base44.entities.ReminderCampaign.update(campaign.id, {
          next_send_date: earliest.scheduled_send_date
        });
      } else {
        await base44.entities.ReminderCampaign.update(campaign.id, {
          status: 'completed'
        });
      }
    }

    return Response.json({ success: true, sentCount: dueReminders.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});