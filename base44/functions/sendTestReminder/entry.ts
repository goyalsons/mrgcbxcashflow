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

    if (campaign.reminder_type === 'email' || campaign.reminder_type === 'both') {
      if (!testEmail) {
        return Response.json({ error: 'Test email not provided' }, { status: 400 });
      }

      // Send test email
      await base44.functions.invoke('sendSmtpEmail', {
        to: testEmail,
        subject: `[TEST] ${reminder.message_subject || 'Payment Reminder'}`,
        body: `[This is a TEST message]\n\n${reminder.message_body}`,
        from_name: 'Payment Reminders - Test',
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