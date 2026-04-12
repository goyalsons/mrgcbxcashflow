import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function callGemini(apiKey, model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini API error');
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return JSON.parse(text);
}

async function callClaude(apiKey, model, prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Claude API error');
  const text = data.content?.[0]?.text || '';
  // Extract JSON from response
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude did not return valid JSON');
  return JSON.parse(match[0]);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { provider, api_key, model } = body;

    if (!provider || !api_key || !model) {
      return Response.json({ error: 'Missing LLM configuration (provider, api_key, model).' }, { status: 400 });
    }

    const [receivables, payables, expenses, payments, bankAccounts, debtors] = await Promise.all([
      base44.entities.Receivable.list(),
      base44.entities.Payable.list(),
      base44.entities.Expense.list(),
      base44.entities.Payment.list(),
      base44.entities.BankAccount.list(),
      base44.entities.Debtor.list(),
    ]);

    const currentBalance = bankAccounts.reduce((s, a) => s + (a.balance || 0), 0);
    const today = new Date();

    const paidReceivables = receivables.filter(r => r.status === 'paid' && r.invoice_date);
    const avgDaysToPay = paidReceivables.length
      ? Math.round(paidReceivables.reduce((s, r) => {
          const inv = new Date(r.invoice_date);
          const paid = new Date(r.updated_date);
          return s + Math.max(0, (paid - inv) / 86400000);
        }, 0) / paidReceivables.length)
      : 30;

    const totalInvoiced = receivables.reduce((s, r) => s + (r.amount || 0), 0);
    const totalCollected = receivables.reduce((s, r) => s + (r.amount_received || 0), 0);
    const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) : 0.8;

    const monthlyPayments = {};
    payments.forEach(p => {
      if (!p.payment_date) return;
      const monthKey = p.payment_date.substring(0, 7);
      monthlyPayments[monthKey] = (monthlyPayments[monthKey] || 0) + (p.amount || 0);
    });

    const monthlyExpenses = {};
    expenses.forEach(e => {
      if (!e.expense_date) return;
      const monthKey = e.expense_date.substring(0, 7);
      monthlyExpenses[monthKey] = (monthlyExpenses[monthKey] || 0) + (e.amount || 0);
    });

    const last12Months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return {
        month: key,
        label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        collected: monthlyPayments[key] || 0,
        spent: monthlyExpenses[key] || 0,
      };
    });

    const pendingReceivables = receivables
      .filter(r => r.status !== 'paid' && r.status !== 'written_off')
      .map(r => ({
        customer: r.customer_name,
        amount: (r.amount || 0) - (r.amount_received || 0),
        due_date: r.due_date,
        overdue: r.due_date < today.toISOString().split('T')[0],
      }));

    const pendingPayables = payables
      .filter(p => p.status !== 'paid')
      .map(p => ({
        vendor: p.vendor_name,
        amount: (p.amount || 0) - (p.amount_paid || 0),
        due_date: p.due_date,
        category: p.category,
      }));

    const totalOutstandingDebt = debtors.reduce((s, d) => s + (d.total_outstanding || 0), 0);
    const activeDebtors = debtors.filter(d => (d.total_outstanding || 0) > 0).length;

    const prompt = `You are a financial analyst AI for an Indian SME. Analyze the following financial data and provide a detailed cash flow projection for the next 6 months.

CURRENT FINANCIAL SNAPSHOT:
- Current Bank Balance: ₹${currentBalance.toLocaleString('en-IN')}
- Total Outstanding from Debtors: ₹${totalOutstandingDebt.toLocaleString('en-IN')} (${activeDebtors} active debtors)
- Average Days to Collect Payment: ${avgDaysToPay} days
- Historical Collection Rate: ${(collectionRate * 100).toFixed(1)}%

LAST 12 MONTHS PAYMENT HISTORY:
${last12Months.map(m => `  ${m.label}: Collected ₹${m.collected.toLocaleString('en-IN')}, Spent ₹${m.spent.toLocaleString('en-IN')}`).join('\n')}

PENDING RECEIVABLES (${pendingReceivables.length} invoices):
${pendingReceivables.slice(0, 10).map(r => `  - ${r.customer}: ₹${r.amount.toLocaleString('en-IN')} due ${r.due_date}${r.overdue ? ' [OVERDUE]' : ''}`).join('\n')}
${pendingReceivables.length > 10 ? `  ... and ${pendingReceivables.length - 10} more` : ''}

PENDING PAYABLES (${pendingPayables.length} bills):
${pendingPayables.slice(0, 10).map(p => `  - ${p.vendor} (${p.category || 'other'}): ₹${p.amount.toLocaleString('en-IN')} due ${p.due_date}`).join('\n')}
${pendingPayables.length > 10 ? `  ... and ${pendingPayables.length - 10} more` : ''}

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "monthly_projection": [{"month":"Apr 2026","projected_inflow":0,"projected_outflow":0,"net_cashflow":0,"closing_balance":0,"confidence":"high|medium|low","risk_level":"safe|caution|danger"}],
  "cash_gaps": [{"period":"string","shortfall":0,"reason":"string","severity":"low|medium|high"}],
  "seasonal_insights": [{"pattern":"string","impact":"positive|negative|neutral","description":"string"}],
  "recommendations": [{"priority":"high|medium|low","action":"string","expected_impact":"string","timeline":"string"}],
  "health_score": 0,
  "health_summary": "string",
  "key_metrics": {"avg_days_to_collect":0,"collection_rate_pct":0,"months_of_runway":0,"overdue_receivables_pct":0}
}`;

    let result;
    if (provider === 'gemini') {
      result = await callGemini(api_key, model, prompt);
    } else if (provider === 'claude') {
      result = await callClaude(api_key, model, prompt);
    } else {
      return Response.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    return Response.json({
      projection: result,
      meta: {
        generated_at: new Date().toISOString(),
        provider,
        model,
        data_points: {
          receivables: receivables.length,
          payables: payables.length,
          payments: payments.length,
          expenses: expenses.length,
        },
      },
    });
  } catch (error) {
    console.error('aiCashFlowProjection error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});