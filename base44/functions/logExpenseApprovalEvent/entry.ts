import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { entity_id, entity_name, approval_status, rejection_reason } = await req.json();

    const auditLog = await base44.entities.AuditLog.create({
      entity_type: 'Expense',
      entity_id,
      entity_name,
      action: 'expense_approved',
      changes: JSON.stringify({ approval_status, rejection_reason }),
      performed_by: user.email,
      performed_by_name: user.full_name,
    });

    return Response.json({ success: true, auditLog });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});