import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { debtorId, campaignName, templateId, reminderType, frequency, startDate, numberOfReminders } = await req.json();

    // Fetch debtor and template
    const debtor = await base44.entities.Debtor.get(debtorId);
    const template = await base44.entities.MessageTemplate.get(templateId);

    if (!debtor || !template) {
      return Response.json({ error: 'Debtor or template not found' }, { status: 404 });
    }

    // Create the campaign
    const campaign = await base44.entities.ReminderCampaign.create({
      debtor_id: debtorId,
      debtor_name: debtor.name,
      campaign_name: campaignName,
      template_id: templateId,
      reminder_type: reminderType,
      frequency,
      start_date: startDate,
      number_of_reminders: numberOfReminders,
      status: 'active',
      created_by: user.email
    });

    // Generate scheduled reminders
    const start = new Date(startDate);
    const reminders = [];

    for (let i = 0; i < numberOfReminders; i++) {
      const scheduledDate = new Date(start);
      if (frequency === 'daily') scheduledDate.setDate(scheduledDate.getDate() + i);
      else if (frequency === 'weekly') scheduledDate.setDate(scheduledDate.getDate() + (i * 7));
      else if (frequency === 'monthly') scheduledDate.setMonth(scheduledDate.getMonth() + i);

      const reminder = await base44.entities.ScheduledReminder.create({
        campaign_id: campaign.id,
        debtor_id: debtorId,
        debtor_email: debtor.email,
        debtor_phone: debtor.phone,
        message_subject: template.subject || '',
        message_body: template.body,
        scheduled_send_date: scheduledDate.toISOString().split('T')[0],
        status: 'pending',
        send_type: reminderType,
        reminder_number: i + 1
      });
      reminders.push(reminder);
    }

    // Update campaign with first scheduled date
    if (reminders.length > 0) {
      await base44.entities.ReminderCampaign.update(campaign.id, {
        next_send_date: reminders[0].scheduled_send_date
      });
    }

    return Response.json({ campaign, reminders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});