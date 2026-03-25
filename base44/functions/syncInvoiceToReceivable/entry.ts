import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    const invoice = data;
    
    // Map Invoice fields to Receivable
    const receivableData = {
      invoice_number: invoice.invoice_number,
      customer_id: invoice.debtor_id,
      customer_name: invoice.debtor_name,
      amount: invoice.amount,
      amount_received: invoice.amount_paid || 0,
      due_date: invoice.due_date,
      invoice_date: invoice.invoice_date,
      status: invoice.status || 'pending',
      bank_account_id: invoice.bank_account_id,
    };

    if (event.type === 'create') {
      // Create Receivable record
      const receivable = await base44.asServiceRole.entities.Receivable.create(receivableData);
      return Response.json({
        ok: true,
        message: 'Receivable synced from Invoice',
        receivableId: receivable.id,
        invoiceNumber: invoice.invoice_number,
      });
    } else if (event.type === 'update') {
      // Find and update matching Receivable by invoice_number
      const existing = await base44.asServiceRole.entities.Receivable.filter({ invoice_number: invoice.invoice_number });
      
      if (existing.length > 0) {
        const receivable = await base44.asServiceRole.entities.Receivable.update(existing[0].id, receivableData);
        return Response.json({
          ok: true,
          message: 'Receivable updated from Invoice',
          receivableId: receivable.id,
          invoiceNumber: invoice.invoice_number,
        });
      } else {
        // If no Receivable exists, create one (fallback)
        const receivable = await base44.asServiceRole.entities.Receivable.create(receivableData);
        return Response.json({
          ok: true,
          message: 'Receivable created from Invoice update',
          receivableId: receivable.id,
          invoiceNumber: invoice.invoice_number,
        });
      }
    }

    return Response.json({ ok: true, skipped: 'Unhandled event type' });
  } catch (error) {
    console.error('Sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});