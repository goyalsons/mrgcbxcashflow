import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const accounts = await base44.asServiceRole.entities.BankAccount.list();
    const now = new Date();
    const snapshot_date = now.toISOString().split('T')[0];
    const snapshot_time = now.toTimeString().slice(0, 5);

    const snapshots = accounts.map(a => ({
      name: a.name,
      type: a.type,
      account_number: a.account_number || '',
      balance: a.balance || 0,
      snapshot_date,
      snapshot_time,
      is_active: a.is_active,
    }));

    for (const snap of snapshots) {
      await base44.asServiceRole.entities.BankAccount.create(snap);
    }

    return Response.json({ success: true, snapshots_created: snapshots.length, date: snapshot_date, time: snapshot_time });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});