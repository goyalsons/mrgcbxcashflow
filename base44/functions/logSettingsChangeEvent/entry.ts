import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { setting_key, old_value, new_value } = await req.json();

    const auditLog = await base44.entities.AuditLog.create({
      entity_type: 'AppSettings',
      entity_name: setting_key,
      action: 'settings_changed',
      changes: JSON.stringify({ setting_key, old_value, new_value }),
      performed_by: user.email,
      performed_by_name: user.full_name,
    });

    return Response.json({ success: true, auditLog });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});