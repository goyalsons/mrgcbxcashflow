import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, campaignId, reminderId, newStatus, newSchedule, automationId } = await req.json();

    if (action === 'getAutoStatus') {
      const existing = await base44.asServiceRole.entities.AppSettings.filter({ key: 'auto_reminders_enabled' });
      const isActive = existing.length > 0 ? existing[0].value !== 'false' : true; // default on
      // Note: Automation is always running; this just controls if sendScheduledReminders skips processing
      return Response.json({ success: true, is_active: isActive });
    }

    if (action === 'activateAutomation' || action === 'deactivateAutomation') {
      const isActive = action === 'activateAutomation';
      // Store the setting in AppSettings so sendScheduledReminders can check it
      const existing = await base44.asServiceRole.entities.AppSettings.filter({ key: 'auto_reminders_enabled' });
      if (existing.length > 0) {
        await base44.asServiceRole.entities.AppSettings.update(existing[0].id, { value: String(isActive) });
      } else {
        await base44.asServiceRole.entities.AppSettings.create({ key: 'auto_reminders_enabled', value: String(isActive) });
      }
      return Response.json({ success: true, is_active: isActive });
    }

    if (action === 'pause' || action === 'resume') {
      const newCampaignStatus = action === 'pause' ? 'paused' : 'active';
      await base44.entities.ReminderCampaign.update(campaignId, { status: newCampaignStatus });
      return Response.json({ success: true, message: `Campaign ${action}d` });
    }

    if (action === 'delete') {
      // Delete all scheduled reminders for this campaign
      const reminders = await base44.entities.ScheduledReminder.filter({ campaign_id: campaignId });
      for (const reminder of reminders) {
        await base44.entities.ScheduledReminder.delete(reminder.id);
      }
      // Delete the campaign
      await base44.entities.ReminderCampaign.delete(campaignId);
      return Response.json({ success: true, message: 'Campaign deleted' });
    }

    if (action === 'updateMessageStatus' && reminderId) {
      await base44.entities.ScheduledReminder.update(reminderId, { status: newStatus });
      return Response.json({ success: true, message: 'Message status updated' });
    }

    if (action === 'updateSchedule' && reminderId && newSchedule) {
      await base44.entities.ScheduledReminder.update(reminderId, { scheduled_send_date: newSchedule });
      return Response.json({ success: true, message: 'Schedule updated' });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});