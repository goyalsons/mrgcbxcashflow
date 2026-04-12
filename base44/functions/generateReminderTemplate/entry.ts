import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { debtorId, reminderType } = await req.json();

    // Fetch debtor data
    const debtor = await base44.entities.Debtor.get(debtorId);
    if (!debtor) {
      return Response.json({ error: 'Debtor not found' }, { status: 404 });
    }

    // Fetch invoices for this debtor
    const invoices = await base44.entities.Invoice.filter({ debtor_id: debtorId });
    const overdue = invoices.filter(inv => inv.status === 'overdue' || inv.status === 'pending');
    const totalOutstanding = debtor.total_outstanding || 0;
    const numOverdueInvoices = overdue.length;

    // Calculate overdue days
    const now = new Date();
    const oldestInvoice = overdue.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
    const overdueDay = oldestInvoice ? Math.floor((now - new Date(oldestInvoice.due_date)) / (1000 * 60 * 60 * 24)) : 0;

    const prompt = reminderType === 'email'
      ? `Generate a professional payment reminder email for a B2B company. 
         Company name: ${debtor.name}
         Amount due: ₹${totalOutstanding.toLocaleString('en-IN')}
         Number of overdue invoices: ${numOverdueInvoices}
         Overdue for: ${overdueDay} days
         
         Create an email with:
         1. A subject line that is professional and concise
         2. A body that is polite but firm, asking for immediate payment
         
         Return as JSON with keys: "subject" and "body"`
      : `Generate a professional payment reminder WhatsApp message for a B2B company.
         Company name: ${debtor.name}
         Amount due: ₹${totalOutstanding.toLocaleString('en-IN')}
         Number of overdue invoices: ${numOverdueInvoices}
         Overdue for: ${overdueDay} days
         
         Create a concise, mobile-friendly WhatsApp message (max 500 chars) that is polite but firm.
         Return as JSON with key: "body"`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: reminderType === 'email'
        ? { type: 'object', properties: { subject: { type: 'string' }, body: { type: 'string' } } }
        : { type: 'object', properties: { body: { type: 'string' } } },
      model: 'gemini_3_1_pro'
    });

    return Response.json({ template: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});