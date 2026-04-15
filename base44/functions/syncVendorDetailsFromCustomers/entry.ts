import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all vendors and customers
    const vendors = await base44.entities.Vendor.list();
    const customers = await base44.entities.Customer.list();

    if (!vendors || !customers) {
      return Response.json({ error: 'Failed to fetch data' }, { status: 500 });
    }

    let synced = 0;
    const updates = [];

    // For each vendor, look for matching customer by name
    for (const vendor of vendors) {
      const vendorName = (vendor.name || '').trim().toLowerCase();
      if (!vendorName) continue;

      // Find matching customer by name
      const matchingCustomer = customers.find(c => 
        (c.name || '').trim().toLowerCase() === vendorName
      );

      if (!matchingCustomer) continue;

      // Build update object with missing fields from customer
      const updateData = {};
      let hasChanges = false;

      // Sync contact_person if missing
      if (!vendor.contact_person && matchingCustomer.contact_person) {
        updateData.contact_person = matchingCustomer.contact_person;
        hasChanges = true;
      }

      // Sync email if missing
      if (!vendor.email && matchingCustomer.email) {
        updateData.email = matchingCustomer.email;
        hasChanges = true;
      }

      // Sync phone if missing
      if (!vendor.phone && matchingCustomer.phone) {
        updateData.phone = matchingCustomer.phone;
        hasChanges = true;
      }

      if (hasChanges) {
        updates.push({ id: vendor.id, data: updateData });
        synced++;
      }
    }

    // Apply all updates
    if (updates.length > 0) {
      await Promise.all(
        updates.map(u => base44.entities.Vendor.update(u.id, u.data))
      );
    }

    return Response.json({ 
      success: true,
      message: `Synced details for ${synced} vendor(s) from customer records`,
      synced
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});