import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all invoices
    const invoices = await base44.asServiceRole.entities.Invoice.list();
    
    // Find overdue invoices (due_date is in the past)
    const today = new Date().toISOString().split('T')[0];
    const overdueInvoices = invoices.filter(inv => 
      inv.due_date && inv.due_date < today && 
      inv.status !== 'paid' && 
      inv.status !== 'written_off'
    );

    if (overdueInvoices.length === 0) {
      return Response.json({ message: 'No overdue invoices found', count: 0 });
    }

    // Fetch debtors and customers data
    const debtors = await base44.asServiceRole.entities.Debtor.list();
    const customers = await base44.asServiceRole.entities.Customer.list();

    // Group invoices by debtor
    const debtorGroups = {};
    overdueInvoices.forEach(inv => {
      const debtorId = inv.debtor_id || inv.customer_id;
      if (debtorId) {
        if (!debtorGroups[debtorId]) {
          debtorGroups[debtorId] = [];
        }
        debtorGroups[debtorId].push(inv);
      }
    });

    // Send reminders for each debtor
    let emailsSent = 0;
    let whatsappSent = 0;
    const errors = [];

    for (const [debtorId, invoices] of Object.entries(debtorGroups)) {
      try {
        const debtor = debtors.find(d => d.id === debtorId);
        const customer = customers.find(c => c.id === debtorId);
        const contact = debtor || customer;

        if (!contact) continue;

        const contactEmail = contact.email;
        const contactPhone = contact.phone;
        const contactName = contact.name;
        const outstanding = invoices.reduce((sum, inv) => 
          sum + ((inv.amount || 0) - (inv.amount_paid || 0)), 0
        );

        // Send email reminder
        if (contactEmail) {
          try {
            const invoiceList = invoices
              .map(inv => {
                const balance = (inv.amount || 0) - (inv.amount_paid || 0);
                const daysOverdue = Math.floor((new Date(today) - new Date(inv.due_date)) / (1000 * 60 * 60 * 24));
                return `• Invoice ${inv.invoice_number}: ₹${balance.toLocaleString('en-IN')} (${daysOverdue} days overdue)`;
              })
              .join('\n');

            const emailBody = `Dear ${contactName},

We hope this email finds you well. We wanted to follow up on the following overdue payment(s):

${invoiceList}

Total Outstanding: ₹${outstanding.toLocaleString('en-IN')}

Please arrange payment at your earliest convenience. If you have any questions or require an invoice copy, feel free to reach out.

Thank you for your prompt attention to this matter.

Best regards,
CashFlow Pro Accounts Team`;

            await base44.asServiceRole.integrations.Core.SendEmail({
              to: contactEmail,
              subject: `Payment Reminder: Outstanding Invoices (₹${outstanding.toLocaleString('en-IN')})`,
              body: emailBody,
            });

            emailsSent++;
          } catch (err) {
            errors.push(`Email failed for ${contactName}: ${err.message}`);
          }
        }

        // Send WhatsApp reminder via RedLava
        const redlavaApiKey = Deno.env.get('REDLAVA_API_KEY');
        const redlavaPhoneId = Deno.env.get('REDLAVA_PHONE_ID');

        if (contactPhone && redlavaApiKey && redlavaPhoneId) {
          try {
            const response = await fetch('https://wa.redlava.in/api/v1/whatsapp/sendMessage', {
              method: 'POST',
              headers: {
                'x-api-key': redlavaApiKey,
                'x-phone-id': redlavaPhoneId,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                templateName: 'payment_reminder',
                language: 'en',
                templateVariables: [contactName, `₹${outstanding.toLocaleString('en-IN')}`],
                to: contactPhone.replace(/\D/g, ''),
              }),
            });

            const data = await response.json();
            if (data.status === 'success') {
              whatsappSent++;
            } else {
              errors.push(`WhatsApp failed for ${contactName}: ${data.message || 'Unknown error'}`);
            }
          } catch (err) {
            errors.push(`WhatsApp error for ${contactName}: ${err.message}`);
          }
        }
      } catch (err) {
        errors.push(`Processing failed for debtor ${debtorId}: ${err.message}`);
      }
    }

    // Log the reminder batch
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        entity_type: 'Invoice',
        action: 'payment_reminder_sent',
        entity_name: `Overdue Reminders - Batch`,
        changes: JSON.stringify({
          total_overdue: overdueInvoices.length,
          emails_sent: emailsSent,
          whatsapp_sent: whatsappSent,
          errors: errors.length > 0 ? errors : null,
        }),
        performed_by: 'system@cashflow-pro.app',
        performed_by_name: 'CashFlow Pro System',
      });
    } catch (err) {
      console.error('Failed to log audit entry:', err.message);
    }

    return Response.json({
      message: 'Overdue reminders processed',
      overdue_count: overdueInvoices.length,
      emails_sent: emailsSent,
      whatsapp_sent: whatsappSent,
      errors: errors.length > 0 ? errors : null,
    });
  } catch (error) {
    console.error('Overdue reminder job failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});