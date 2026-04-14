import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await req.json();
    
    if (!action || !['activate', 'deactivate'].includes(action)) {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Store the setting in AppSettings
    const isActive = action === 'activate';
    const existing = await base44.asServiceRole.entities.AppSettings.filter({ key: 'auto_reminders_enabled' });
    
    if (existing.length > 0) {
      await base44.asServiceRole.entities.AppSettings.update(existing[0].id, { value: String(isActive) });
    } else {
      await base44.asServiceRole.entities.AppSettings.create({ key: 'auto_reminders_enabled', value: String(isActive) });
    }

    return Response.json({ success: true, is_active: isActive });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});