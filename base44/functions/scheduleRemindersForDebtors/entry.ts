import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { debtorIds, numberOfReminders, frequency, startDate, mode } = await req.json();

    if (!debtorIds?.length) return Response.json({ error: 'No debtors provided' }, { status: 400 });

    // Fetch all templates once
    const allTemplates = await base44.entities.MessageTemplate.list();

    const getTemplate = (type, num) => {
      const name = `${type}_reminder_${num}`;
      // Try exact match first, then fallback to reminder_1
      return allTemplates.find(t => t.name === name && t.is_active !== false)
        || allTemplates.find(t => t.name === `${type}_reminder_1` && t.is_active !== false)
        || allTemplates.find(t => t.type === type && t.is_active !== false);
    };

    let totalCreated = 0;

    for (const debtorId of debtorIds) {
      const debtor = await base44.entities.Debtor.get(debtorId);
      if (!debtor) continue;

      // Determine channels
      const channels = mode === 'both' ? ['email', 'whatsapp'] : [mode];

      // Create a lightweight campaign record as a grouping handle
      const campaign = await base44.entities.ReminderCampaign.create({
        debtor_id: debtorId,
        debtor_name: debtor.name,
        campaign_name: `Reminders - ${debtor.name} - ${startDate}`,
        template_id: 'auto',
        reminder_type: mode === 'both' ? 'email' : mode,
        frequency,
        start_date: startDate,
        number_of_reminders: numberOfReminders,
        status: 'active',
        created_by: user.email,
      });

      for (const channel of channels) {
        const start = new Date(startDate);

        for (let i = 0; i < numberOfReminders; i++) {
          const scheduledDate = new Date(start);
          if (frequency === 'daily') scheduledDate.setDate(scheduledDate.getDate() + i);
          else if (frequency === 'weekly') scheduledDate.setDate(scheduledDate.getDate() + i * 7);
          else if (frequency === 'monthly') scheduledDate.setMonth(scheduledDate.getMonth() + i);

          const template = getTemplate(channel, i + 1);

          let messageBody = template?.body || `Dear ${debtor.name}, this is reminder #${i + 1} for your outstanding payment. Please settle your dues at the earliest.`;
          let messageSubject = template?.subject || `Payment Reminder #${i + 1} - ${debtor.name}`;

          // Simple placeholder substitution
          messageBody = messageBody
            .replace(/{debtor_name}/g, debtor.name)
            .replace(/{{1}}/g, debtor.name)
            .replace(/{amount}/g, debtor.total_outstanding || '')
            .replace(/{due_date}/g, scheduledDate.toISOString().split('T')[0]);

          await base44.entities.ScheduledReminder.create({
            campaign_id: campaign.id,
            debtor_id: debtorId,
            debtor_email: debtor.email || '',
            debtor_phone: debtor.phone || '',
            message_subject: messageSubject,
            message_body: messageBody,
            scheduled_send_date: scheduledDate.toISOString().split('T')[0],
            status: 'pending',
            send_type: channel,
            reminder_number: i + 1,
          });

          totalCreated++;
        }
      }

      // Update campaign next_send_date
      await base44.entities.ReminderCampaign.update(campaign.id, {
        next_send_date: startDate,
      });
    }

    return Response.json({ success: true, totalCreated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});