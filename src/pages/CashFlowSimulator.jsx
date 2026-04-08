import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import SimImpactBar from '@/components/simulator/SimImpactBar';
import SimSectionA from '@/components/simulator/SimSectionA';
import SimSectionB from '@/components/simulator/SimSectionB';
import SimSectionC from '@/components/simulator/SimSectionC';
import SimSectionD, { buildSourceFlows } from '@/components/simulator/SimSectionD';
import SimSectionE from '@/components/simulator/SimSectionE';
import SimSectionF from '@/components/simulator/SimSectionF';
import SimAdjustmentDrawer from '@/components/simulator/SimAdjustmentDrawer';
import SimChart from '@/components/simulator/SimChart';
import SimTable from '@/components/simulator/SimTable';
import FundingSummaryCard from '@/components/simulator/FundingSummaryCard';

function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
const toDateStr = d => d ? new Date(d).toISOString().split('T')[0] : '';

const EXP_CATEGORIES = {
  salary: 'Salary', rent: 'Rent/Utilities', utilities: 'Rent/Utilities',
  travel: 'Travel', marketing: 'Marketing', software: 'Software',
  maintenance: 'Maintenance', office_supplies: 'Office & Other',
  meals: 'Office & Other', miscellaneous: 'Office & Other',
};
const EXPENSE_GROUPS = ['Salary', 'Rent/Utilities', 'Travel', 'Marketing', 'Software', 'Maintenance', 'Office & Other'];

export function buildWeeklyData(receivables, invoices, payables, expenses, bankAccounts, recAdj, payAdj, hypotheticals, fundingSources, levers, taxItems) {
  const today = new Date(); today.setHours(0,0,0,0);
  const openingBalance = bankAccounts.reduce((s, a) => s + (a.balance || 0), 0);

  const expByGroup = {};
  EXPENSE_GROUPS.forEach(g => expByGroup[g] = 0);
  expenses.forEach(e => { const g = EXP_CATEGORIES[e.category] || 'Office & Other'; expByGroup[g] = (expByGroup[g] || 0) + (e.amount || 0); });
  EXPENSE_GROUPS.forEach(k => expByGroup[k] = expByGroup[k] / 52);

  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = addDays(today, i * 7);
    const end   = addDays(today, (i + 1) * 7 - 1);
    return {
      start, end,
      label: `W${i+1} (${String(start.getDate()).padStart(2,'0')}/${String(start.getMonth()+1).padStart(2,'0')})`,
      isCurrentWeek: i === 0,
      baseInflow: 0, baseOutflow: 0,
      simInflow: 0, simOutflow: 0,
      fundingInflow: 0, repaymentOutflow: 0,
      simItems: [],
    };
  });

  const inWeek = (dateStr, w) => { const d = new Date(dateStr); return d >= w.start && d <= w.end; };

  // Baseline inflow from receivables + invoices
  [...receivables, ...invoices].forEach(r => {
    if (['paid','written_off'].includes(r.status)) return;
    const w = weeks.find(w => inWeek(r.due_date, w));
    if (w) w.baseInflow += (r.amount || 0) - (r.amount_received || r.amount_paid || 0);
  });
  // Baseline outflow from payables
  payables.filter(p => p.status !== 'paid').forEach(p => {
    const w = weeks.find(w => inWeek(p.due_date, w));
    if (w) w.baseOutflow += (p.amount || 0) - (p.amount_paid || 0);
  });
  // Baseline expenses
  weeks.forEach(w => { EXPENSE_GROUPS.forEach(g => { w.baseOutflow += Math.round(expByGroup[g] || 0); }); });

  // Copy baseline into sim
  weeks.forEach(w => { w.simInflow = w.baseInflow; w.simOutflow = w.baseOutflow; });

  // --- Apply receivable adjustments ---
  recAdj.forEach((adj, id) => {
    const item = [...receivables, ...invoices].find(r => r.id === id);
    if (!item) return;
    const originalAmt = (item.amount || 0) - (item.amount_received || item.amount_paid || 0);
    const origWeek = weeks.find(w => inWeek(item.due_date, w));
    if (origWeek) origWeek.simInflow -= originalAmt;
    adj.tranches.forEach(t => {
      const tw = weeks.find(w => inWeek(t.date, w));
      if (tw) { tw.simInflow += Number(t.amount); tw.simItems.push({ label: item.customer_name || item.debtor_name || 'Invoice', amount: Number(t.amount), type: 'inflow', split: adj.tranches.length > 1 }); }
    });
    if (adj.remainder > 0 && origWeek) origWeek.simInflow += adj.remainder;
  });

  // --- Apply payable adjustments ---
  payAdj.forEach((adj, id) => {
    const item = payables.find(p => p.id === id);
    if (!item) return;
    const originalAmt = (item.amount || 0) - (item.amount_paid || 0);
    const origWeek = weeks.find(w => inWeek(item.due_date, w));
    if (origWeek) origWeek.simOutflow -= originalAmt;
    adj.tranches.forEach(t => {
      const tw = weeks.find(w => inWeek(t.date, w));
      if (tw) { tw.simOutflow += Number(t.amount); tw.simItems.push({ label: item.vendor_name || 'Payable', amount: Number(t.amount), type: 'outflow', split: adj.tranches.length > 1 }); }
    });
    if (adj.remainder > 0 && origWeek) origWeek.simOutflow += adj.remainder;
  });

  // --- Hypotheticals ---
  hypotheticals.forEach(h => {
    h.tranches.forEach(t => {
      const tw = weeks.find(w => inWeek(t.date, w));
      if (tw) {
        if (h.type === 'inflow') { tw.simInflow += Number(t.amount); tw.simItems.push({ label: h.label, amount: Number(t.amount), type: 'inflow', hypo: true }); }
        else { tw.simOutflow += Number(t.amount); tw.simItems.push({ label: h.label, amount: Number(t.amount), type: 'outflow', hypo: true }); }
      }
    });
  });

  // --- Funding sources (Section D) → fundingInflow / repaymentOutflow ---
  fundingSources.forEach(f => {
    const { inflows, outflows } = buildSourceFlows(f);
    inflows.forEach(inf => {
      const tw = weeks.find(w => inWeek(inf.date, w));
      if (tw) { tw.simInflow += inf.amount; tw.fundingInflow += inf.amount; tw.simItems.push({ label: inf.label, amount: inf.amount, type: 'inflow', funding: true }); }
    });
    outflows.forEach(out => {
      const tw = weeks.find(w => inWeek(out.date, w));
      if (tw) { tw.simOutflow += out.amount; tw.repaymentOutflow += out.amount; tw.simItems.push({ label: out.label, amount: out.amount, type: 'outflow', repayment: true }); }
    });
  });

  // --- Cost levers (Section E) ---
  levers.forEach(l => {
    if (l.type === 'salary_defer') {
      const weeklyDeferred = Math.round((expByGroup['Salary'] || 0) * (Number(l.deferPct)||0) / 100);
      const nWeeks = Math.min(Number(l.weeks)||0, 12);
      for (let i = 0; i < nWeeks; i++) { if (weeks[i]) weeks[i].simOutflow -= weeklyDeferred; }
      const resumeWeek = weeks.find(w => inWeek(l.resumeDate, w));
      if (resumeWeek) resumeWeek.simOutflow += weeklyDeferred * nWeeks;
    }
    if (l.type === 'rent_defer') {
      const monthlyAmt = Number(l.monthlyAmt) || 0;
      const months = Number(l.deferMonths) || 1;
      const weeklyRent = monthlyAmt / 4;
      for (let i = 0; i < Math.min(months * 4, 12); i++) { if (weeks[i]) weeks[i].simOutflow -= Math.round(weeklyRent); }
      const resumeWeek = weeks.find(w => inWeek(l.resumeDate, w));
      if (resumeWeek) resumeWeek.simOutflow += Math.round(monthlyAmt * months);
    }
    if (l.type === 'tax_defer' && l.amount) {
      const origWeek = weeks.find(w => inWeek(l.origDate, w));
      const newWeek  = weeks.find(w => inWeek(l.newDate, w));
      const amt = Number(l.amount);
      const days = Math.max(0, Math.round((new Date(l.newDate) - new Date(l.origDate)) / 86400000));
      const penalty = l.taxType === 'TDS' ? Math.round(amt * 0.01 * Math.ceil(days / 30)) : Math.round(amt * 0.18 / 365 * days);
      if (origWeek) origWeek.simOutflow -= amt;
      if (newWeek)  newWeek.simOutflow  += amt + penalty;
    }
    if (l.type === 'owner_drawings') {
      const saving = (Number(l.current) - Number(l.reduced)) / 4;
      const durWeeks = Math.min(Number(l.duration||3) * 4, 12);
      for (let i = 0; i < durWeeks; i++) { if (weeks[i]) weeks[i].simOutflow -= Math.round(saving); }
    }
    if (l.type === 'early_pay_disc' && l.payableId) {
      const pItem = payables.find(p => p.id === l.payableId);
      if (pItem) {
        const origWeek = weeks.find(w => inWeek(pItem.due_date, w));
        const newWeek  = weeks.find(w => inWeek(l.newDate, w));
        const bal = (pItem.amount || 0) - (pItem.amount_paid || 0);
        const disc = Math.round(bal * (Number(l.discPct)||0) / 100);
        if (origWeek) origWeek.simOutflow -= bal;
        if (newWeek)  newWeek.simOutflow  += bal - disc;
      }
    }
  });

  // --- Tax items (Section F) ---
  taxItems.forEach(t => {
    if (t.type === 'itc' && t.amount && t.month) {
      // Reduce outflow in weeks matching that month
      weeks.filter(w => {
        const wm = `${w.start.getFullYear()}-${String(w.start.getMonth()+1).padStart(2,'0')}`;
        return wm === t.month;
      }).forEach((w, i, arr) => { if (i === 0) w.simOutflow -= Number(t.amount); });
    }
    if (t.type === 'advance_tax' && t.amount) {
      const origWeek = weeks.find(w => inWeek(t.origDate, w));
      const newWeek  = weeks.find(w => inWeek(t.newDate, w));
      if (origWeek) origWeek.simOutflow -= Number(t.amount);
      if (newWeek)  newWeek.simOutflow  += Number(t.amount);
    }
    if (t.type === 'tds_refund' && t.amount) {
      const tw = weeks.find(w => inWeek(t.date, w));
      if (tw) { tw.simInflow += Number(t.amount); tw.fundingInflow += Number(t.amount); }
    }
  });

  // Compute net + running balances
  let baseRunning = openingBalance, simRunning = openingBalance;
  return weeks.map(w => {
    const baseNet = Math.round(w.baseInflow - w.baseOutflow);
    const simNet  = Math.round(w.simInflow  - w.simOutflow);
    baseRunning += baseNet; simRunning += simNet;
    return { ...w, baseNet, simNet, baseClosing: Math.round(baseRunning), simClosing: Math.round(simRunning) };
  });
}

export default function CashFlowSimulator() {
  const { data: receivables = [] }       = useQuery({ queryKey: ['receivables'],       queryFn: () => base44.entities.Receivable.list() });
  const { data: invoices = [] }          = useQuery({ queryKey: ['invoices'],          queryFn: () => base44.entities.Invoice.list() });
  const { data: collectionTargets = [] } = useQuery({ queryKey: ['collectionTargets'], queryFn: () => base44.entities.CollectionTarget.list() });
  const { data: payables = [] }          = useQuery({ queryKey: ['payables'],          queryFn: () => base44.entities.Payable.list() });
  const { data: expenses = [] }          = useQuery({ queryKey: ['expenses'],          queryFn: () => base44.entities.Expense.list() });
  const { data: recurringExpenses = [] } = useQuery({ queryKey: ['recurringExpenses'], queryFn: () => base44.entities.Expense.filter({ recurrence_type: 'monthly' }) });
  const { data: bankAccounts = [] }      = useQuery({ queryKey: ['bankAccounts'],      queryFn: () => base44.entities.BankAccount.list() });

  const [recAdj, setRecAdj]       = useState(new Map());
  const [payAdj, setPayAdj]       = useState(new Map());
  const [hypotheticals, setHypo]  = useState([]);
  const [fundingSources, setFunding] = useState([]);
  const [levers, setLevers]       = useState([]);
  const [taxItems, setTaxItems]   = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const expByGroup = useMemo(() => {
    const g = {};
    ['Salary','Rent/Utilities','Travel','Marketing','Software','Maintenance','Office & Other'].forEach(k => g[k] = 0);
    expenses.forEach(e => { const grp = EXP_CATEGORIES[e.category] || 'Office & Other'; g[grp] = (g[grp]||0) + (e.amount||0); });
    Object.keys(g).forEach(k => g[k] = g[k] / 52);
    return g;
  }, [expenses]);

  const weeklyData = useMemo(() =>
    buildWeeklyData(receivables, invoices, payables, expenses, bankAccounts, recAdj, payAdj, hypotheticals, fundingSources, levers, taxItems),
    [receivables, invoices, payables, expenses, bankAccounts, recAdj, payAdj, hypotheticals, fundingSources, levers, taxItems]
  );

  const baseNet12W = weeklyData.reduce((s, w) => s + w.baseNet, 0);
  const simNet12W  = weeklyData.reduce((s, w) => s + w.simNet,  0);
  const improvement = simNet12W - baseNet12W;

  const resetAll = useCallback(() => {
    setRecAdj(new Map()); setPayAdj(new Map()); setHypo([]);
    setFunding([]); setLevers([]); setTaxItems([]);
  }, []);

  const totalAdjCount = recAdj.size + payAdj.size + hypotheticals.length + fundingSources.length + levers.length + taxItems.length;

  return (
    <div className="flex flex-col min-h-0">
      <PageHeader
        title="Cash Flow Simulator"
        subtitle="Model what-if scenarios by adjusting receivable and payable dates, splitting payments, and simulating funding sources."
      />

      <SimImpactBar baseNet={baseNet12W} simNet={simNet12W} improvement={improvement} onReset={resetAll} />

      <div className="flex gap-5 mt-4 items-start">
        {/* Left panel */}
        <div className="w-[35%] shrink-0 space-y-4 overflow-y-auto max-h-[calc(100vh-220px)] pb-6 pr-1">
          <SimSectionA receivables={receivables} invoices={invoices} adjustments={recAdj} setAdjustments={setRecAdj} />
          <SimSectionB payables={payables} adjustments={payAdj} setAdjustments={setPayAdj} />
          <SimSectionC hypotheticals={hypotheticals} setHypotheticals={setHypo} />
          <SimSectionD sources={fundingSources} setSources={setFunding} receivables={[...receivables, ...invoices]} />
          <SimSectionE levers={levers} setLevers={setLevers} recurringExpenses={recurringExpenses} payables={payables} expByGroup={expByGroup} />
          <SimSectionF taxItems={taxItems} setTaxItems={setTaxItems} />
          <SimAdjustmentDrawer
            open={drawerOpen} onToggle={() => setDrawerOpen(v => !v)}
            recAdj={recAdj} setRecAdj={setRecAdj}
            payAdj={payAdj} setPayAdj={setPayAdj}
            hypotheticals={hypotheticals} setHypo={setHypo}
            fundingSources={fundingSources} setFunding={setFunding}
            levers={levers} setLevers={setLevers}
            taxItems={taxItems} setTaxItems={setTaxItems}
            receivables={[...receivables, ...invoices]} payables={payables}
            count={totalAdjCount}
          />
        </div>

        {/* Right panel */}
        <div className="flex-1 space-y-4 sticky top-4">
          <SimChart weeklyData={weeklyData} />
          <SimTable weeklyData={weeklyData} bankAccounts={bankAccounts} />
          <FundingSummaryCard weeklyData={weeklyData} />
          <p className="text-xs text-muted-foreground text-center pb-4 px-2">
            All simulations are for planning purposes only. Salary deferrals, tax payment deferrals, and statutory obligations are subject to applicable laws and regulations. Consult your Chartered Accountant or legal advisor before acting on any simulation. This tool does not modify any actual records.
          </p>
        </div>
      </div>
    </div>
  );
}