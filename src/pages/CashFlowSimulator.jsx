import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
import ScenarioManager from '@/components/simulator/ScenarioManager';
import SimExport from '@/components/simulator/SimExport';
import useDebounce from '@/hooks/useDebounce';

function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }

const EXP_CATEGORIES = {
  salary: 'Salary', rent: 'Rent/Utilities', utilities: 'Rent/Utilities',
  travel: 'Travel', marketing: 'Marketing', software: 'Software',
  maintenance: 'Maintenance', office_supplies: 'Office & Other',
  meals: 'Office & Other', miscellaneous: 'Office & Other',
};
const EXPENSE_GROUPS = ['Salary', 'Rent/Utilities', 'Travel', 'Marketing', 'Software', 'Maintenance', 'Office & Other'];

export function buildWeeklyData(receivables, invoices, payables, expenses, bankAccounts, recAdj, payAdj, hypotheticals, fundingSources, levers, taxItems, collectionTargets = [], expAdj = new Map()) {
  const today = new Date(); today.setHours(0,0,0,0);
  const openingBalance = bankAccounts.reduce((s, a) => s + (a.balance || 0), 0);

  // Build expense group totals, excluding individually-deferred expenses
  const adjustedExpenseIds = new Set(expAdj.keys());
  const expByGroup = {};
  EXPENSE_GROUPS.forEach(g => expByGroup[g] = 0);
  expenses.forEach(e => {
    if (adjustedExpenseIds.has(e.id)) return; // excluded — will be added explicitly
    const g = EXP_CATEGORIES[e.category] || 'Office & Other';
    expByGroup[g] = (expByGroup[g] || 0) + (e.amount || 0);
  });
  EXPENSE_GROUPS.forEach(k => expByGroup[k] = expByGroup[k] / 12);

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

  [...receivables, ...invoices].forEach(r => {
    if (['paid','written_off'].includes(r.status)) return;
    const w = weeks.find(w => inWeek(r.due_date, w));
    if (w) w.baseInflow += (r.amount || 0) - (r.amount_received || r.amount_paid || 0);
  });

  collectionTargets.forEach(ct => {
    const remaining = (ct.target_amount || 0) - (ct.collected_amount || 0);
    if (remaining <= 0) return;
    const matchingWeeks = weeks.filter(w => w.start.getMonth() + 1 === ct.period_month && w.start.getFullYear() === ct.period_year);
    if (matchingWeeks.length > 0) {
      const perWeek = remaining / matchingWeeks.length;
      matchingWeeks.forEach(w => w.baseInflow += perWeek);
    }
  });

  payables.filter(p => p.status !== 'paid').forEach(p => {
    const w = weeks.find(w => inWeek(p.due_date, w));
    if (w) w.baseOutflow += (p.amount || 0) - (p.amount_paid || 0);
  });
  weeks.forEach(w => { EXPENSE_GROUPS.forEach(g => { w.baseOutflow += Math.round(expByGroup[g] || 0); }); });

  // Add individually-deferred expenses at their original dates for baseline
  expAdj.forEach((adj, id) => {
    const item = expenses.find(e => e.id === id);
    if (!item) return;
    const origWeek = weeks.find(w => inWeek(item.expense_date, w));
    if (origWeek) origWeek.baseOutflow += item.amount || 0;
  });

  weeks.forEach(w => { w.simInflow = w.baseInflow; w.simOutflow = w.baseOutflow; });

  // Apply expense deferrals to sim
  expAdj.forEach((adj, id) => {
    const item = expenses.find(e => e.id === id);
    if (!item) return;
    const origWeek = weeks.find(w => inWeek(item.expense_date, w));
    const newWeek  = weeks.find(w => inWeek(adj.date, w));
    if (origWeek) origWeek.simOutflow -= item.amount || 0;
    if (newWeek)  { newWeek.simOutflow += item.amount || 0; newWeek.simItems.push({ label: item.description || 'Expense', amount: item.amount || 0, type: 'outflow' }); }
  });

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

  hypotheticals.forEach(h => {
    h.tranches.forEach(t => {
      const tw = weeks.find(w => inWeek(t.date, w));
      if (tw) {
        if (h.type === 'inflow') { tw.simInflow += Number(t.amount); tw.simItems.push({ label: h.label, amount: Number(t.amount), type: 'inflow', hypo: true }); }
        else { tw.simOutflow += Number(t.amount); tw.simItems.push({ label: h.label, amount: Number(t.amount), type: 'outflow', hypo: true }); }
      }
    });
  });

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

  taxItems.forEach(t => {
    if (t.type === 'itc' && t.amount && t.month) {
      const matchWeeks = weeks.filter(w => {
        const wm = `${w.start.getFullYear()}-${String(w.start.getMonth()+1).padStart(2,'0')}`;
        return wm === t.month;
      });
      if (matchWeeks[0]) matchWeeks[0].simOutflow -= Number(t.amount);
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
  const { data: payables = [] }          = useQuery({ queryKey: ['payables'],          queryFn: () => base44.entities.Payable.list() });
  const { data: expenses = [] }          = useQuery({ queryKey: ['expenses'],          queryFn: () => base44.entities.Expense.list() });
  const { data: recurringExpenses = [] }    = useQuery({ queryKey: ['recurringExpensesAll'],    queryFn: () => base44.entities.Expense.filter({ recurrence_type: 'monthly' }) });
  const { data: collectionTargets = [] }    = useQuery({ queryKey: ['collectionTargets'],         queryFn: () => base44.entities.CollectionTarget.list() });
  const { data: bankAccounts = [] }      = useQuery({ queryKey: ['bankAccounts'],      queryFn: () => base44.entities.BankAccount.list() });

  const [recAdj, setRecAdj]            = useState(new Map());
  const [payAdj, setPayAdj]            = useState(new Map());
  const [expAdj, setExpAdj]            = useState(new Map());
  const [hypotheticals, setHypo]       = useState([]);
  const [fundingSources, setFunding]   = useState([]);
  const [levers, setLevers]            = useState([]);
  const [taxItems, setTaxItems]        = useState([]);
  const [drawerOpen, setDrawerOpen]    = useState(false);
  const [currentScenarioId, setCurrentScenarioId] = useState(null);
  const [activeScenarioName, setActiveScenarioName] = useState(null);

  const expByGroup = useMemo(() => {
    const g = {};
    EXPENSE_GROUPS.forEach(k => g[k] = 0);
    expenses.forEach(e => { const grp = EXP_CATEGORIES[e.category] || 'Office & Other'; g[grp] = (g[grp]||0) + (e.amount||0); });
    Object.keys(g).forEach(k => g[k] = g[k] / 12); // monthly avg, matches CashFlowForecast
    return g;
  }, [expenses]);

  const adjState = useMemo(() => ({ recAdj, payAdj, expAdj, hypotheticals, fundingSources, levers, taxItems }), [recAdj, payAdj, expAdj, hypotheticals, fundingSources, levers, taxItems]);
  const debouncedAdj = useDebounce(adjState, 300);

  // Memoize baseline data (static input — only recalculate if underlying entity data changes)
  const baselineInputs = useMemo(() => ({ receivables, invoices, payables, expenses, bankAccounts, collectionTargets }), [receivables, invoices, payables, expenses, bankAccounts, collectionTargets]);

  const weeklyData = useMemo(() =>
    buildWeeklyData(
      baselineInputs.receivables, baselineInputs.invoices,
      baselineInputs.payables, baselineInputs.expenses, baselineInputs.bankAccounts,
      debouncedAdj.recAdj, debouncedAdj.payAdj, debouncedAdj.hypotheticals,
      debouncedAdj.fundingSources, debouncedAdj.levers, debouncedAdj.taxItems,
      baselineInputs.collectionTargets, debouncedAdj.expAdj
    ),
    [baselineInputs, debouncedAdj]
  );

  const baseNet12W = weeklyData.reduce((s, w) => s + w.baseNet, 0);
  const simNet12W  = weeklyData.reduce((s, w) => s + w.simNet,  0);
  const improvement = simNet12W - baseNet12W;

  const resetAll = useCallback(() => {
    setRecAdj(new Map()); setPayAdj(new Map()); setExpAdj(new Map()); setHypo([]);
    setFunding([]); setLevers([]); setTaxItems([]);
    setCurrentScenarioId(null); setActiveScenarioName(null);
  }, []);

  const loadScenario = useCallback((state) => {
    setRecAdj(state.recAdj || new Map());
    setPayAdj(state.payAdj || new Map());
    setExpAdj(state.expAdj || new Map());
    setHypo(state.hypotheticals || []);
    setFunding(state.fundingSources || []);
    setLevers(state.levers || []);
    setTaxItems(state.taxItems || []);
  }, []);

  const totalAdjCount = recAdj.size + payAdj.size + expAdj.size + hypotheticals.length + fundingSources.length + levers.length + taxItems.length;
  const hasAdjustments = totalAdjCount > 0;

  const currentState = { recAdj, payAdj, expAdj, hypotheticals, fundingSources, levers, taxItems };

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Cash Flow Simulator</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Model what-if scenarios — adjust dates, splits, funding sources, and cost levers.</p>
          {activeScenarioName && <p className="text-xs text-primary mt-0.5 font-medium">Active scenario: {activeScenarioName}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <ScenarioManager
            currentState={currentState}
            onLoad={(state) => loadScenario(state)}
            weeklyData={weeklyData}
            currentScenarioId={currentScenarioId}
            setCurrentScenarioId={setCurrentScenarioId}
          />
          <SimExport
            weeklyData={weeklyData}
            bankAccounts={bankAccounts}
            scenarioName={activeScenarioName}
            fundingSources={fundingSources}
            levers={levers}
            taxItems={taxItems}
            recAdj={recAdj}
            payAdj={payAdj}
            hypotheticals={hypotheticals}
          />
        </div>
      </div>

      <SimImpactBar baseNet={baseNet12W} simNet={simNet12W} improvement={improvement} onReset={resetAll} />

      {/* Responsive two-panel layout */}
      <div className="flex flex-col lg:flex-row gap-5 mt-4 items-start">
        {/* Left panel */}
        <div className="w-full lg:w-[35%] shrink-0 space-y-4 pb-6 lg:pr-1">
          <SimSectionB payables={payables} adjustments={payAdj} setAdjustments={setPayAdj} expenses={expenses} expAdj={expAdj} setExpAdj={setExpAdj} />
          <SimSectionA receivables={receivables} invoices={invoices} adjustments={recAdj} setAdjustments={setRecAdj} />
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
        <div className="flex-1 space-y-4 lg:sticky lg:top-4 w-full">
          <SimChart weeklyData={weeklyData} hasAdjustments={hasAdjustments} />
          <SimTable weeklyData={weeklyData} bankAccounts={bankAccounts} />
          <FundingSummaryCard weeklyData={weeklyData} />
        </div>
      </div>

      {/* Persistent disclaimer footer */}
      <div className="mt-6 pt-4 border-t">
        <p className="text-[11px] text-muted-foreground text-center leading-relaxed max-w-4xl mx-auto">
          All simulations are for planning purposes only. Salary deferrals, tax payment deferrals, and all statutory obligations are subject to applicable Indian laws and regulations including but not limited to the Companies Act, Income Tax Act, GST Act, and applicable labour laws. Consult your Chartered Accountant or legal advisor before acting on any simulation result. This tool does not modify any actual records in your system.
        </p>
      </div>
    </div>
  );
}