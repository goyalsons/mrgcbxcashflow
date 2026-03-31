import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Get the debtor name from the payment event
    const debtorName = body?.data?.debtor_name;
    if (!debtorName) {
      return Response.json({ message: 'No debtor_name in payload, skipping.' });
    }

    // Get all payments for this debtor
    const allPayments = await base44.asServiceRole.entities.Payment.filter({ debtor_name: debtorName });
    const totalPaid = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Get all receivables for this customer (matched by name)
    const receivables = await base44.asServiceRole.entities.Receivable.filter({ customer_name: debtorName });
    if (!receivables.length) {
      return Response.json({ message: 'No receivables found for debtor.', debtorName });
    }

    // Distribute payments across receivables oldest-first (waterfall)
    let remaining = totalPaid;
    for (const rec of receivables) {
      const recAmount = rec.amount || 0;
      const amountReceived = Math.min(remaining, recAmount);
      remaining = Math.max(0, remaining - recAmount);

      let status = 'pending';
      if (amountReceived >= recAmount) status = 'paid';
      else if (amountReceived > 0) status = 'partially_paid';
      else if (new Date(rec.due_date) < new Date()) status = 'overdue';

      await base44.asServiceRole.entities.Receivable.update(rec.id, {
        amount_received: amountReceived,
        status,
      });
    }

    return Response.json({ success: true, debtorName, totalPaid, receivablesUpdated: receivables.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});