import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all debtors and customers
    const debtors = await base44.asServiceRole.entities.Debtor.list();
    const customers = await base44.asServiceRole.entities.Customer.list();
    const customerNames = new Set(customers.map(c => c.name));

    let created = 0;
    let skipped = 0;

    // Sync each debtor to customer
    for (const debtor of debtors) {
      if (!customerNames.has(debtor.name)) {
        try {
          await base44.asServiceRole.entities.Customer.create({
            name: debtor.name,
            contact_person: debtor.contact_person || '',
            email: debtor.email || '',
            phone: debtor.phone || '',
            gstin: debtor.gstin || '',
            address: debtor.address || '',
          });
          created++;
        } catch (err) {
          console.error(`Failed to create customer for debtor ${debtor.name}:`, err.message);
        }
      } else {
        skipped++;
      }
    }

    return Response.json({
      ok: true,
      message: `Bulk sync complete: ${created} created, ${skipped} skipped`,
      created,
      skipped,
      total: debtors.length,
    });
  } catch (error) {
    console.error('Bulk sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});