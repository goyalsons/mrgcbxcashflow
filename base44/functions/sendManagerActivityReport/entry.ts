import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function formatINR(amount) {
  return '₹' + (amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const FOLLOW_UP_TYPES = ['call', 'email', 'whatsapp', 'visit', 'sms', 'note'];

Deno.serve(async (req) => {
  try {
  const base44 = createClientFromRequest(req);

  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

  // Date range — default to last 7 days
  const today = new Date();
  const defaultFrom = new Date(today); defaultFrom.setDate(today.getDate() - 6);
  const dateFrom = body.dateFrom || defaultFrom.toISOString().split('T')[0];
  const dateTo = body.dateTo || today.toISOString().split('T')[0];
  const toEmail = body.to;

  const from = new Date(dateFrom); from.setHours(0, 0, 0, 0);
  const to = new Date(dateTo); to.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7); sevenDaysAgo.setHours(0, 0, 0, 0);

  const [followUps, debtors, payments, invoices, targets, users] = await Promise.all([
    base44.asServiceRole.entities.FollowUp.list(),
    base44.asServiceRole.entities.Debtor.list(),
    base44.asServiceRole.entities.Payment.list(),
    base44.asServiceRole.entities.Invoice.list(),
    base44.asServiceRole.entities.CollectionTarget.list(),
    base44.asServiceRole.entities.User.list(),
  ]);

  const managerEmails = [...new Set(debtors.map(d => d.assigned_manager).filter(Boolean))];
  const now = new Date();

  const reportRows = managerEmails.map(email => {
    const u = users.find(x => x.email === email);
    const name = u?.full_name || email.split('@')[0];

    const myDebtors = debtors.filter(d => d.assigned_manager === email);
    const myDebtorIds = new Set(myDebtors.map(d => d.id));

    const myFollowUps = followUps.filter(f => {
      const d = new Date(f.follow_up_date);
      return f.created_by === email && d >= from && d <= to;
    });

    const typeBreakdown = {};
    FOLLOW_UP_TYPES.forEach(t => { typeBreakdown[t] = 0; });
    myFollowUps.forEach(f => { if (f.type) typeBreakdown[f.type] = (typeBreakdown[f.type] || 0) + 1; });

    const uniqueDebtorsContacted = new Set(myFollowUps.map(f => f.debtor_id).filter(Boolean)).size;

    const promisedValue = myFollowUps
      .filter(f => f.outcome === 'promised_payment' && f.promise_amount)
      .reduce((s, f) => s + (f.promise_amount || 0), 0);

    const collected = payments
      .filter(p => {
        const d = new Date(p.payment_date);
        return myDebtorIds.has(p.debtor_id) && d >= from && d <= to;
      })
      .reduce((s, p) => s + (p.amount || 0), 0);

    const myTarget = targets.find(t =>
      t.manager_email === email &&
      t.period_month === now.getMonth() + 1 &&
      t.period_year === now.getFullYear()
    );
    const targetAmount = myTarget?.target_amount || 0;
    const targetPct = targetAmount > 0 ? Math.min(Math.round((collected / targetAmount) * 100), 999) : null;

    const overdueDebtorIds = new Set(
      invoices
        .filter(i => {
          const d = new Date(i.due_date);
          return myDebtorIds.has(i.debtor_id) && d < new Date() && i.status !== 'paid' && i.status !== 'written_off';
        })
        .map(i => i.debtor_id)
    );
    const recentlyContactedIds = new Set(
      followUps
        .filter(f => {
          const d = new Date(f.follow_up_date);
          return f.created_by === email && d >= sevenDaysAgo;
        })
        .map(f => f.debtor_id)
    );
    const noFollowUpOverdue = [...overdueDebtorIds].filter(id => !recentlyContactedIds.has(id)).length;

    return { name, email, myDebtors: myDebtors.length, totalFollowUps: myFollowUps.length, typeBreakdown, uniqueDebtorsContacted, promisedValue, collected, targetAmount, targetPct, noFollowUpOverdue };
  }).sort((a, b) => b.collected - a.collected);

  const dateLabel = `${dateFrom} to ${dateTo}`;

  const tableRows = reportRows.map(r => {
    const types = FOLLOW_UP_TYPES.filter(t => r.typeBreakdown[t] > 0).map(t => `${t}: ${r.typeBreakdown[t]}`).join(', ') || '—';
    const targetStr = r.targetPct !== null ? `${r.targetPct}%` : 'No target';
    const flagStyle = r.noFollowUpOverdue > 0 ? 'color:#dc2626;font-weight:700;' : 'color:#16a34a;';
    const flagVal = r.noFollowUpOverdue > 0 ? `⚠ ${r.noFollowUpOverdue}` : '✓';
    const targetColor = r.targetPct === null ? '#6b7280' : r.targetPct >= 100 ? '#16a34a' : r.targetPct >= 70 ? '#d97706' : '#dc2626';
    return `<tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:10px 12px;font-weight:600;">${r.name}<br><span style="font-size:11px;color:#6b7280;font-weight:400;">${r.email} · ${r.myDebtors} debtors</span></td>
      <td style="padding:10px 12px;text-align:center;font-weight:700;">${r.totalFollowUps}</td>
      <td style="padding:10px 12px;font-size:11px;color:#6b7280;">${types}</td>
      <td style="padding:10px 12px;text-align:center;">${r.uniqueDebtorsContacted}</td>
      <td style="padding:10px 12px;text-align:right;">${formatINR(r.promisedValue)}</td>
      <td style="padding:10px 12px;text-align:right;font-weight:700;color:#16a34a;">${formatINR(r.collected)}</td>
      <td style="padding:10px 12px;text-align:center;font-weight:600;color:${targetColor};">${targetStr}</td>
      <td style="padding:10px 12px;text-align:center;${flagStyle}">${flagVal}</td>
    </tr>`;
  }).join('');

  const totalFollowUps = reportRows.reduce((s, r) => s + r.totalFollowUps, 0);
  const totalCollected = reportRows.reduce((s, r) => s + r.collected, 0);
  const totalFlags = reportRows.reduce((s, r) => s + r.noFollowUpOverdue, 0);
  const totalPromised = reportRows.reduce((s, r) => s + r.promisedValue, 0);
  const reportDate = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:750px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#3b4cca,#5b6ef5);padding:24px 28px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">📊 Account Manager Activity Report</h1>
      <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px;">${dateLabel} · Generated ${reportDate}</p>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-bottom:1px solid #e5e7eb;">
      <div style="padding:16px 20px;border-right:1px solid #e5e7eb;text-align:center;">
        <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;">Managers</p>
        <p style="margin:6px 0 0;font-size:24px;font-weight:800;">${reportRows.length}</p>
      </div>
      <div style="padding:16px 20px;border-right:1px solid #e5e7eb;text-align:center;">
        <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;">Follow-Ups</p>
        <p style="margin:6px 0 0;font-size:24px;font-weight:800;">${totalFollowUps}</p>
      </div>
      <div style="padding:16px 20px;border-right:1px solid #e5e7eb;text-align:center;">
        <p style="margin:0;font-size:11px;color:#16a34a;text-transform:uppercase;">Collected</p>
        <p style="margin:6px 0 0;font-size:24px;font-weight:800;color:#16a34a;">${formatINR(totalCollected)}</p>
      </div>
      <div style="padding:16px 20px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#dc2626;text-transform:uppercase;">⚠ Flags</p>
        <p style="margin:6px 0 0;font-size:24px;font-weight:800;color:#dc2626;">${totalFlags}</p>
      </div>
    </div>

    <div style="padding:20px 28px;">
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;">Manager Breakdown</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">Manager</th>
            <th style="padding:10px 12px;text-align:center;color:#6b7280;font-weight:600;">Follow-Ups</th>
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">Type Breakdown</th>
            <th style="padding:10px 12px;text-align:center;color:#6b7280;font-weight:600;">Debtors Contacted</th>
            <th style="padding:10px 12px;text-align:right;color:#6b7280;font-weight:600;">Promised</th>
            <th style="padding:10px 12px;text-align:right;color:#6b7280;font-weight:600;">Collected</th>
            <th style="padding:10px 12px;text-align:center;color:#6b7280;font-weight:600;">Target %</th>
            <th style="padding:10px 12px;text-align:center;color:#6b7280;font-weight:600;">⚠ No Follow-Up</th>
          </tr>
        </thead>
        <tbody>${tableRows || '<tr><td colspan="8" style="text-align:center;padding:20px;color:#6b7280;">No data found for this period.</td></tr>'}</tbody>
        <tfoot>
          <tr style="background:#f9fafb;font-weight:700;">
            <td style="padding:10px 12px;">Total</td>
            <td style="padding:10px 12px;text-align:center;">${totalFollowUps}</td>
            <td></td>
            <td></td>
            <td style="padding:10px 12px;text-align:right;">${formatINR(totalPromised)}</td>
            <td style="padding:10px 12px;text-align:right;color:#16a34a;">${formatINR(totalCollected)}</td>
            <td></td>
            <td style="padding:10px 12px;text-align:center;color:#dc2626;">${totalFlags > 0 ? `⚠ ${totalFlags}` : '✓ All clear'}</td>
          </tr>
        </tfoot>
      </table>
      ${totalFlags > 0 ? `
      <div style="margin-top:16px;padding:12px 16px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;font-size:12px;color:#dc2626;">
        <strong>⚠ Accountability Alert:</strong> ${totalFlags} overdue account(s) have had no follow-up activity in the last 7 days. Immediate action required.
      </div>` : ''}
    </div>

    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:14px 28px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#9ca3af;">Generated by CashFlow Pro · Account Manager Activity Report</p>
    </div>
  </div>
</body>
</html>`;

  // Determine recipients
  let recipients = [];
  if (toEmail) {
    recipients.push(toEmail);
  } else {
    // For automated sends — email all admin users
    const adminUsers = users.filter(u => u.role === 'admin' && u.email);
    recipients = adminUsers.map(u => u.email);
  }

  const sentTo = [];
  for (const recipient of recipients) {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: recipient,
      subject: `📊 Account Manager Activity Report — ${dateLabel}`,
      body: html,
    });
    sentTo.push(recipient);
  }

  return Response.json({ success: true, sent_to: sentTo, managers: reportRows.length, date_range: dateLabel });
  } catch (error) {
    console.error('sendManagerActivityReport error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});