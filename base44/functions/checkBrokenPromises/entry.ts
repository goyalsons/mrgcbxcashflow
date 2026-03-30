import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const today = new Date().toISOString().split('T')[0];

  // Get all follow-ups with promised_payment outcome whose promise_date has passed
  const followUps = await base44.asServiceRole.entities.FollowUp.list();
  const receivables = await base44.asServiceRole.entities.Receivable.list();
  const notifications = await base44.asServiceRole.entities.Notification.list();

  const existingNotifIds = new Set(
    notifications
      .filter(n => n.entity_type === 'FollowUp')
      .map(n => n.entity_id)
  );

  let brokenCount = 0;

  for (const fu of followUps) {
    if (fu.outcome !== 'promised_payment') continue;
    if (!fu.promise_date || fu.promise_date >= today) continue;
    if (fu.promise_status === 'broken') continue; // already marked

    // Check if a matching payment was received in Receivables after the promise was made
    const paid = receivables.some(r =>
      r.customer_name === fu.debtor_name &&
      r.amount_received > 0 &&
      r.invoice_date >= fu.follow_up_date
    );

    if (paid) continue; // promise was kept

    // Mark as broken
    await base44.asServiceRole.entities.FollowUp.update(fu.id, {
      promise_status: 'broken',
    });

    brokenCount++;

    // Fire a high-priority notification (only once per follow-up)
    if (!existingNotifIds.has(fu.id)) {
      await base44.asServiceRole.entities.Notification.create({
        type: 'reminder',
        title: `Broken Promise: ${fu.debtor_name}`,
        message: `${fu.debtor_name} promised ₹${fu.promise_amount?.toLocaleString('en-IN') || '?'} by ${fu.promise_date} — payment not received.`,
        priority: 'high',
        is_read: false,
        entity_type: 'FollowUp',
        entity_id: fu.id,
        action_url: '/follow-up-schedule',
      });
    }
  }

  return Response.json({ success: true, broken_count: brokenCount });
});