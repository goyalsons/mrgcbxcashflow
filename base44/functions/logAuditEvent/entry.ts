import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity_type, entity_id, entity_name, action, changes } = await req.json();

    if (!entity_type || !action) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const auditLog = await base44.entities.AuditLog.create({
      entity_type,
      entity_id,
      entity_name,
      action,
      changes: typeof changes === 'string' ? changes : JSON.stringify(changes),
      performed_by: user.email,
      performed_by_name: user.full_name,
    });

    return Response.json({ success: true, auditLog });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});