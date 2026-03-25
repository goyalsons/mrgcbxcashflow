import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (event.type === 'create') {
      // Debtor created → create corresponding Customer
      const debtor = data;
      
      const customerData = {
        name: debtor.name,
        contact_person: debtor.contact_person || '',
        email: debtor.email || '',
        phone: debtor.phone || '',
        gstin: debtor.gstin || '',
        address: debtor.address || '',
      };

      const customer = await base44.asServiceRole.entities.Customer.create(customerData);
      return Response.json({
        ok: true,
        message: 'Customer synced from Debtor',
        customerId: customer.id,
        debtorId: debtor.id,
      });
    } else if (event.type === 'update') {
      // Debtor updated → find and update corresponding Customer
      const debtor = data;
      const existing = await base44.asServiceRole.entities.Customer.filter({ name: debtor.name });
      
      if (existing.length > 0) {
        const customerData = {
          name: debtor.name,
          contact_person: debtor.contact_person || '',
          email: debtor.email || '',
          phone: debtor.phone || '',
          gstin: debtor.gstin || '',
          address: debtor.address || '',
        };
        
        await base44.asServiceRole.entities.Customer.update(existing[0].id, customerData);
        return Response.json({
          ok: true,
          message: 'Customer updated from Debtor',
          customerId: existing[0].id,
        });
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Debtor-Customer sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});