import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (event.type === 'create') {
      // Customer created → create corresponding Debtor
      const customer = data;
      
      const debtorData = {
        name: customer.name,
        contact_person: customer.contact_person || '',
        email: customer.email || '',
        phone: customer.phone || '',
        gstin: customer.gstin || '',
        address: customer.address || '',
        status: 'active',
      };

      const debtor = await base44.asServiceRole.entities.Debtor.create(debtorData);
      return Response.json({
        ok: true,
        message: 'Debtor synced from Customer',
        debtorId: debtor.id,
        customerId: customer.id,
      });
    } else if (event.type === 'update') {
      // Customer updated → find and update corresponding Debtor
      const customer = data;
      const existing = await base44.asServiceRole.entities.Debtor.filter({ name: customer.name });
      
      if (existing.length > 0) {
        const debtorData = {
          name: customer.name,
          contact_person: customer.contact_person || '',
          email: customer.email || '',
          phone: customer.phone || '',
          gstin: customer.gstin || '',
          address: customer.address || '',
        };
        
        await base44.asServiceRole.entities.Debtor.update(existing[0].id, debtorData);
        return Response.json({
          ok: true,
          message: 'Debtor updated from Customer',
          debtorId: existing[0].id,
        });
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Customer-Debtor sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});