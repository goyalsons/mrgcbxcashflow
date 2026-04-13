import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { debtorIds, frequencyType, selectedDays, startDate, sendTime, emailTemplateId, whatsappTemplateId, mode } = await req.json();

    if (!debtorIds?.length) return Response.json({ error: 'No debtors provided' }, { status: 400 });

    let totalCreated = 0;

    for (const debtorId of debtorIds) {
      const debtor = await base44.entities.Debtor.get(debtorId);
      if (!debtor) continue;

      // Determine channels
      const channels = mode === 'both' ? ['email', 'whatsapp'] : [mode];

      // Create campaign
      const campaign = await base44.entities.ReminderCampaign.create({
        debtor_id: debtorId,
        debtor_name: debtor.name,
        campaign_name: `Reminders - ${debtor.name} - ${startDate}`,
        template_id: mode === 'email' ? emailTemplateId : whatsappTemplateId,
        reminder_type: mode === 'both' ? 'email' : mode,
        frequency: frequencyType,
        start_date: startDate,
        number_of_reminders: 1,
        status: 'active',
        created_by: user.email,
      });

      for (const channel of channels) {
        const templateId = channel === 'email' ? emailTemplateId : whatsappTemplateId;
        const template = await base44.entities.MessageTemplate.get(templateId);

        if (!template) continue;

        const messageBody = template.body || 'Please settle your outstanding payment.';
        const messageSubject = template.subject || `Payment Reminder - ${debtor.name}`;

        // Create initial scheduled reminder with next send date/time
        const nextSendDateTime = calculateNextSendDateTime(startDate, sendTime, frequencyType, selectedDays);

        await base44.entities.ScheduledReminder.create({
          campaign_id: campaign.id,
          debtor_id: debtorId,
          debtor_email: debtor.email || '',
          debtor_phone: debtor.phone || '',
          message_subject: messageSubject,
          message_body: messageBody,
          scheduled_send_date: nextSendDateTime.date,
          scheduled_send_time: nextSendDateTime.time,
          status: 'pending',
          send_type: channel,
          reminder_number: 1,
        });

        totalCreated++;
      }

      // Update campaign next send date
      const nextSend = calculateNextSendDateTime(startDate, sendTime, frequencyType, selectedDays);
      await base44.entities.ReminderCampaign.update(campaign.id, {
        next_send_date: nextSend.date,
        last_sent_date: null,
      });
    }

    return Response.json({ success: true, totalCreated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function calculateNextSendDateTime(startDate, sendTime, frequencyType, selectedDays) {
  const [hours, minutes] = sendTime.split(':').map(Number);
  let sendDateTime = new Date(startDate);
  sendDateTime.setHours(hours, minutes, 0, 0);

  const now = new Date();

  if (frequencyType === 'weekly') {
    // Find next occurrence in selectedDays
    const dayMap = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 0 };
    const targetDays = [...selectedDays].map(d => dayMap[d]).sort((a, b) => a - b);

    while (sendDateTime <= now) {
      const dayOfWeek = sendDateTime.getDay();
      const nextDay = targetDays.find(d => d > dayOfWeek) || targetDays[0];

      if (nextDay > dayOfWeek) {
        sendDateTime.setDate(sendDateTime.getDate() + (nextDay - dayOfWeek));
      } else {
        sendDateTime.setDate(sendDateTime.getDate() + (7 - dayOfWeek + nextDay));
      }
    }
  } else if (frequencyType === 'daily') {
    while (sendDateTime <= now) {
      sendDateTime.setDate(sendDateTime.getDate() + 1);
    }
  } else if (frequencyType === 'monthly') {
    while (sendDateTime <= now) {
      sendDateTime.setMonth(sendDateTime.getMonth() + 1);
    }
  }

  const dateStr = sendDateTime.toISOString().split('T')[0];
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return { date: dateStr, time: timeStr };
}