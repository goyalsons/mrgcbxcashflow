import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity_type, entity_id, entity_name, amount, payment_mode, reference_number } = await req.json();

    const auditLog = await base44.entities.AuditLog.create({
      entity_type,
      entity_id,
      entity_name,
      action: 'payment_recorded',
      changes: JSON.stringify({ amount, payment_mode, reference_number }),
      performed_by: user.email,
      performed_by_name: user.full_name,
    });

    return Response.json({ success: true, auditLog });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});