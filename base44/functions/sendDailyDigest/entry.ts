import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function formatINR(amount) {
  return '₹' + (amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const [invoices, payments, debtors, bankAccounts, followUps, payables] = await Promise.all([
    base44.asServiceRole.entities.Invoice.list(),
    base44.asServiceRole.entities.Payment.list(),
    base44.asServiceRole.entities.Debtor.list(),
    base44.asServiceRole.entities.BankAccount.list(),
    base44.asServiceRole.entities.FollowUp.list(),
    base44.asServiceRole.entities.Payable.list(),
  ]);

  // Compute metrics
  const overdueInvoices = invoices.filter(i =>
    i.due_date && i.due_date < today && i.status !== 'paid' && i.status !== 'written_off'
  );
  const overdueAmount = overdueInvoices.reduce((s, i) => s + ((i.amount || 0) - (i.amount_paid || 0)), 0);
  const overdueDebtorSet = new Set(overdueInvoices.map(i => i.debtor_id).filter(Boolean));

  const dueTodayInvoices = invoices.filter(i =>
    i.due_date === today && i.status !== 'paid' && i.status !== 'written_off'
  );
  const dueTodayAmount = dueTodayInvoices.reduce((s, i) => s + ((i.amount || 0) - (i.amount_paid || 0)), 0);

  const yesterdayPayments = payments.filter(p => p.payment_date === yesterday);
  const yesterdayTotal = yesterdayPayments.reduce((s, p) => s + (p.amount || 0), 0);

  const totalBankBalance = bankAccounts.reduce((s, b) => s + (b.balance || 0), 0);
  const totalOutstandingPayables = payables
    .filter(p => p.status !== 'paid')
    .reduce((s, p) => s + ((p.amount || 0) - (p.amount_paid || 0)), 0);
  const netCashPosition = totalBankBalance - totalOutstandingPayables;

  const top3Debtors = [...debtors]
    .filter(d => (d.total_outstanding || 0) > 0)
    .sort((a, b) => (b.total_outstanding || 0) - (a.total_outstanding || 0))
    .slice(0, 3);

  const todayFollowUps = followUps.filter(f => f.next_follow_up_date === today);

  const todayDisplay = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // --- Build HTML Email ---
  const top3Html = top3Debtors.map(d =>
    `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;">${d.name}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#dc2626;">${formatINR(d.total_outstanding)}</td>
    </tr>`
  ).join('');

  const dueTodayHtml = dueTodayInvoices.slice(0, 5).map(i =>
    `<tr>
      <td style="padding:5px 12px;border-bottom:1px solid #f0f0f0;">${i.debtor_name || '—'}</td>
      <td style="padding:5px 12px;border-bottom:1px solid #f0f0f0;">${i.invoice_number || '—'}</td>
      <td style="padding:5px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">${formatINR((i.amount || 0) - (i.amount_paid || 0))}</td>
    </tr>`
  ).join('');

  const followUpHtml = todayFollowUps.length === 0
    ? '<p style="color:#6b7280;font-size:13px;">No follow-ups scheduled for today.</p>'
    : todayFollowUps.slice(0, 5).map(f =>
        `<div style="padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px;">
          <strong>${f.debtor_name}</strong> — ${f.type || 'call'}
          ${f.notes ? `<span style="color:#6b7280;"> · ${f.notes.slice(0, 60)}</span>` : ''}
        </div>`
      ).join('');

  const htmlEmail = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:600px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#3b4cca,#5b6ef5);padding:24px 28px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">☀️ Daily Cash Digest</h1>
      <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px;">${todayDisplay}</p>
    </div>

    <!-- Net Cash Position Banner -->
    <div style="background:${netCashPosition >= 0 ? '#f0fdf4' : '#fef2f2'};border-left:4px solid ${netCashPosition >= 0 ? '#16a34a' : '#dc2626'};padding:16px 28px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Net Cash Position</p>
        <p style="margin:4px 0 0;font-size:28px;font-weight:800;color:${netCashPosition >= 0 ? '#16a34a' : '#dc2626'};">${formatINR(netCashPosition)}</p>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;font-size:12px;color:#6b7280;">Bank Balance</p>
        <p style="margin:2px 0 0;font-size:16px;font-weight:600;">${formatINR(totalBankBalance)}</p>
      </div>
    </div>

    <div style="padding:20px 28px;">
      <!-- Summary Row -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
        <div style="background:#fef2f2;border-radius:8px;padding:14px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#dc2626;text-transform:uppercase;font-weight:600;">Overdue</p>
          <p style="margin:6px 0 0;font-size:18px;font-weight:800;color:#dc2626;">${formatINR(overdueAmount)}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">${overdueDebtorSet.size} debtor${overdueDebtorSet.size !== 1 ? 's' : ''} · ${overdueInvoices.length} inv.</p>
        </div>
        <div style="background:#fffbeb;border-radius:8px;padding:14px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#d97706;text-transform:uppercase;font-weight:600;">Due Today</p>
          <p style="margin:6px 0 0;font-size:18px;font-weight:800;color:#d97706;">${formatINR(dueTodayAmount)}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">${dueTodayInvoices.length} invoice${dueTodayInvoices.length !== 1 ? 's' : ''}</p>
        </div>
        <div style="background:#f0fdf4;border-radius:8px;padding:14px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#16a34a;text-transform:uppercase;font-weight:600;">Received Yesterday</p>
          <p style="margin:6px 0 0;font-size:18px;font-weight:800;color:#16a34a;">${formatINR(yesterdayTotal)}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">${yesterdayPayments.length} payment${yesterdayPayments.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      ${dueTodayInvoices.length > 0 ? `
      <!-- Due Today -->
      <h3 style="margin:0 0 10px;font-size:14px;font-weight:700;color:#111827;">📅 Due Today</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;">Debtor</th>
            <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;">Invoice</th>
            <th style="padding:8px 12px;text-align:right;color:#6b7280;font-weight:600;">Amount</th>
          </tr>
        </thead>
        <tbody>${dueTodayHtml}</tbody>
      </table>` : ''}

      ${top3Debtors.length > 0 ? `
      <!-- Top 3 Debtors -->
      <h3 style="margin:0 0 10px;font-size:14px;font-weight:700;color:#111827;">🏆 Top Debtors by Outstanding</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
        <tbody>${top3Html}</tbody>
      </table>` : ''}

      <!-- Follow-Ups Today -->
      <h3 style="margin:0 0 10px;font-size:14px;font-weight:700;color:#111827;">📞 Follow-Ups Today</h3>
      <div style="margin-bottom:24px;">${followUpHtml}</div>

    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:14px 28px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#9ca3af;">This digest was sent by CashFlow Pro · <a href="#" style="color:#6b7280;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`;

  // --- Build WhatsApp plain text ---
  const top3Lines = top3Debtors.map((d, i) => `  ${i + 1}. ${d.name}: ${formatINR(d.total_outstanding)}`).join('\n');
  const followUpLines = todayFollowUps.length === 0
    ? '  (none)'
    : todayFollowUps.slice(0, 5).map(f => `  • ${f.debtor_name} — ${f.type || 'call'}`).join('\n');

  const whatsappText =
`☀️ *Daily Cash Digest* — ${todayDisplay}

💰 *Net Cash Position:* ${formatINR(netCashPosition)}
🏦 Bank Balance: ${formatINR(totalBankBalance)}

📊 *Summary*
🔴 Overdue: ${formatINR(overdueAmount)} (${overdueInvoices.length} invoices, ${overdueDebtorSet.size} debtors)
🟡 Due Today: ${formatINR(dueTodayAmount)} (${dueTodayInvoices.length} invoices)
🟢 Received Yesterday: ${formatINR(yesterdayTotal)} (${yesterdayPayments.length} payments)

🏆 *Top Debtors*
${top3Lines || '  (none)'}

📞 *Follow-Ups Today*
${followUpLines}

_— CashFlow Pro_`;

  // --- Fetch digest config from settings entity (stored by frontend) ---
  const digestConfig = req.method === 'POST'
    ? await req.json().catch(() => ({}))
    : {};

  const sendEmail = digestConfig.send_email !== false;
  const sendWhatsApp = digestConfig.send_whatsapp === true;
  const recipientEmail = digestConfig.recipient_email || '';
  const recipientPhone = digestConfig.recipient_phone || '';

  const results = {};

  // Send email
  if (sendEmail && recipientEmail) {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: recipientEmail,
      subject: `☀️ Daily Cash Digest — ${todayDisplay}`,
      body: htmlEmail,
    });
    results.email = 'sent';
  }

  // Send WhatsApp via Meta API
  if (sendWhatsApp && recipientPhone) {
    const waUrl = Deno.env.get('WHATSAPP_API_URL');
    const waToken = Deno.env.get('WHATSAPP_TOKEN');
    const waPhoneId = Deno.env.get('WHATSAPP_PHONE_ID');

    if (waUrl && waToken && waPhoneId) {
      const waRes = await fetch(`${waUrl}/${waPhoneId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${waToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipientPhone.replace(/\D/g, ''),
          type: 'text',
          text: { body: whatsappText },
        }),
      });
      results.whatsapp = waRes.ok ? 'sent' : 'failed';
    } else {
      results.whatsapp = 'not_configured';
    }
  }

  return Response.json({
    success: true,
    date: today,
    metrics: {
      net_cash_position: netCashPosition,
      bank_balance: totalBankBalance,
      overdue_amount: overdueAmount,
      overdue_invoices: overdueInvoices.length,
      due_today_amount: dueTodayAmount,
      due_today_invoices: dueTodayInvoices.length,
      yesterday_received: yesterdayTotal,
      top_debtors: top3Debtors.map(d => ({ name: d.name, outstanding: d.total_outstanding })),
      followups_today: todayFollowUps.length,
    },
    delivery: results,
  });
});