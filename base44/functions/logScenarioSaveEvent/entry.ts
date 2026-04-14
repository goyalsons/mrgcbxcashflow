import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { scenario_id, scenario_name, net_improvement } = await req.json();

    const auditLog = await base44.entities.AuditLog.create({
      entity_type: 'SimulatorScenario',
      entity_id: scenario_id,
      entity_name: scenario_name,
      action: 'scenario_saved',
      changes: JSON.stringify({ scenario_name, net_improvement }),
      performed_by: user.email,
      performed_by_name: user.full_name,
    });

    return Response.json({ success: true, auditLog });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});