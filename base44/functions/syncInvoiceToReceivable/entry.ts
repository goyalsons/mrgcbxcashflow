import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Only process on Invoice creation
    if (event.type !== 'create') {
      return Response.json({ ok: true, skipped: 'Not a create event' });
    }

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

    // Create Receivable record
    const receivable = await base44.asServiceRole.entities.Receivable.create(receivableData);

    return Response.json({
      ok: true,
      message: 'Receivable synced from Invoice',
      receivableId: receivable.id,
      invoiceNumber: invoice.invoice_number,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});