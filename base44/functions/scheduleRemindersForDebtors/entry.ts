import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { debtorIds, frequencyType, selectedDays, selectedMonthlyDays, startDate, sendTime, emailTemplateId, whatsappTemplateId, mode } = payload;

    if (!debtorIds || debtorIds.length === 0) {
      return Response.json({ error: 'No debtors provided' }, { status: 400 });
    }

    if (!startDate || !sendTime) {
      return Response.json({ error: 'Start date and send time are required' }, { status: 400 });
    }

    if ((mode === 'email' || mode === 'both') && !emailTemplateId) {
      return Response.json({ error: 'Email template required' }, { status: 400 });
    }

    if ((mode === 'whatsapp' || mode === 'both') && !whatsappTemplateId) {
      return Response.json({ error: 'WhatsApp template required' }, { status: 400 });
    }

    let totalCreated = 0;
    const daysArray = Array.from(selectedDays);
    const monthDaysArray = Array.from(selectedMonthlyDays);

    for (const customerId of debtorIds) {
      const customer = await base44.entities.Customer.get(customerId);
      if (!customer) {
        console.warn(`Customer ${customerId} not found, skipping`);
        continue;
      }

      // Determine channels
      const channels = [];
      if (mode === 'email' || mode === 'both') channels.push('email');
      if (mode === 'whatsapp' || mode === 'both') channels.push('whatsapp');

      if (channels.length === 0) {
        console.warn(`No valid channels for customer ${customerId}`);
        continue;
      }

      // Create one campaign per customer per primary channel
      const primaryChannel = channels[0];
      const campaign = await base44.entities.ReminderCampaign.create({
        debtor_id: customerId,
        debtor_name: customer.name,
        campaign_name: `Payment Reminders - ${customer.name}`,
        template_id: primaryChannel === 'email' ? emailTemplateId : whatsappTemplateId,
        reminder_type: primaryChannel,
        frequency: frequencyType,
        start_date: startDate,
        number_of_reminders: 5,
        status: 'active',
        created_by: user.email,
      });

      const nextSend = calculateNextSendDateTime(startDate, sendTime, frequencyType, daysArray, monthDaysArray);

      // Create scheduled reminders for each channel
      for (const channel of channels) {
        const templateId = channel === 'email' ? emailTemplateId : whatsappTemplateId;
        const template = await base44.entities.MessageTemplate.get(templateId);
        if (!template) {
          console.warn(`Template ${templateId} not found for channel ${channel}`);
          continue;
        }

        const email = customer.email || '';
        const phone = customer.phone || '';

        if (channel === 'email' && !email) {
          console.warn(`Customer ${customerId} has no email, skipping email reminder`);
          continue;
        }

        if (channel === 'whatsapp' && !phone) {
          console.warn(`Customer ${customerId} has no phone, skipping WhatsApp reminder`);
          continue;
        }

        await base44.entities.ScheduledReminder.create({
          campaign_id: campaign.id,
          customer_id: customerId,
          customer_email: email,
          customer_phone: phone,
          message_subject: template.subject || '',
          message_body: template.body || '',
          scheduled_send_date: nextSend.date,
          scheduled_send_time: nextSend.time,
          status: 'pending',
          send_type: channel,
          reminder_number: 1,
        });

        totalCreated++;
      }
    }

    return Response.json({ success: true, totalCreated });
  } catch (error) {
    console.error('[scheduleRemindersForDebtors] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function calculateNextSendDateTime(startDate, sendTime, frequencyType, selectedDays, selectedMonthlyDays) {
  const [hours, minutes] = sendTime.split(':').map(Number);
  const start = new Date(startDate);
  start.setHours(hours, minutes, 0, 0);
  const now = new Date();

  if (start > now) {
    return formatDateTime(start, hours, minutes);
  }

  let next = new Date(start);

  if (frequencyType === 'daily') {
    next.setDate(next.getDate() + 1);
  } else if (frequencyType === 'weekly') {
    const dayMap = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 0 };
    const targetDays = selectedDays.map(d => dayMap[d]).sort((a, b) => a - b);

    do {
      next.setDate(next.getDate() + 1);
      const dayOfWeek = next.getDay();
      if (!targetDays.includes(dayOfWeek)) continue;
      if (next > now) break;
    } while (true);
  } else if (frequencyType === 'monthly') {
    const targetDays = selectedMonthlyDays.sort((a, b) => a - b);
    do {
      const currentDay = next.getDate();
      const nextTargetDay = targetDays.find(d => d > currentDay);

      if (nextTargetDay) {
        next.setDate(nextTargetDay);
      } else {
        next.setMonth(next.getMonth() + 1);
        next.setDate(targetDays[0]);
      }

      if (next > now) break;
    } while (true);
  }

  return formatDateTime(next, hours, minutes);
}

function formatDateTime(date, hours, minutes) {
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return { date: dateStr, time: timeStr };
}