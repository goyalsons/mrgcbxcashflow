import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all receivables and debtors
    const [receivables, debtors] = await Promise.all([
      base44.asServiceRole.entities.Receivable.list(),
      base44.asServiceRole.entities.Debtor.list(),
    ]);

    // Aggregate totals per customer_name (case-insensitive)
    const totalsMap = {};
    for (const r of receivables) {
      const key = (r.customer_name || '').toLowerCase().trim();
      if (!key) continue;
      if (!totalsMap[key]) totalsMap[key] = { total_invoiced: 0, total_received: 0, total_outstanding: 0 };
      totalsMap[key].total_invoiced += r.amount || 0;
      totalsMap[key].total_received += r.amount_received || 0;
      totalsMap[key].total_outstanding += (r.amount || 0) - (r.amount_received || 0);
    }

    // Update each debtor with computed totals
    let updated = 0;
    for (const debtor of debtors) {
      const key = (debtor.name || '').toLowerCase().trim();
      const totals = totalsMap[key];
      if (!totals) continue;

      // Only update if values differ
      const changed =
        Math.abs((debtor.total_invoiced || 0) - totals.total_invoiced) > 0.01 ||
        Math.abs((debtor.total_received || 0) - totals.total_received) > 0.01 ||
        Math.abs((debtor.total_outstanding || 0) - totals.total_outstanding) > 0.01;

      if (changed) {
        await base44.asServiceRole.entities.Debtor.update(debtor.id, totals);
        updated++;
      }
    }

    // Also create missing debtors for customer_names not in debtors list
    const debtorNameSet = new Set(debtors.map(d => (d.name || '').toLowerCase().trim()));
    const newDebtors = [];
    for (const [key, totals] of Object.entries(totalsMap)) {
      if (!debtorNameSet.has(key)) {
        // Find original casing from receivables
        const sample = receivables.find(r => (r.customer_name || '').toLowerCase().trim() === key);
        newDebtors.push({ name: sample?.customer_name || key, status: 'active', ...totals });
      }
    }

    if (newDebtors.length > 0) {
      const BATCH = 25;
      for (let i = 0; i < newDebtors.length; i += BATCH) {
        await base44.asServiceRole.entities.Debtor.bulkCreate(newDebtors.slice(i, i + BATCH));
      }
    }

    return Response.json({ success: true, updated, created: newDebtors.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});