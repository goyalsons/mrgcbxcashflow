import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import SimImpactBar from '@/components/simulator/SimImpactBar';
import SimSectionA from '@/components/simulator/SimSectionA';
import SimSectionB from '@/components/simulator/SimSectionB';
import SimSectionC from '@/components/simulator/SimSectionC';
import SimAdjustmentDrawer from '@/components/simulator/SimAdjustmentDrawer';
import SimChart from '@/components/simulator/SimChart';
import SimTable from '@/components/simulator/SimTable';

function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }

export function buildWeeklyData(receivables, invoices, collectionTargets, payables, expenses, bankAccounts, adjustments, hypotheticals, weekOffset = 0) {
  const today = new Date(); today.setHours(0,0,0,0);
  const startDay = addDays(today, weekOffset * 7);
  const openingBalance = bankAccounts.reduce((s, a) => s + (a.balance || 0), 0);

  const EXP_CATEGORIES = {
    salary: 'Salary', rent: 'Rent/Utilities', utilities: 'Rent/Utilities',
    travel: 'Travel', marketing: 'Marketing', software: 'Software',
    maintenance: 'Maintenance', office_supplies: 'Office & Other',
    meals: 'Office & Other', miscellaneous: 'Office & Other',
  };
  const totalExpPerWeek = expenses.reduce((s, e) => s + (e.amount || 0), 0) / 52;

  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = addDays(startDay, i * 7);
    const end   = addDays(startDay, (i + 1) * 7 - 1);
    return { start, end, label: `W${i+1} (${String(start.getDate()).padStart(2,'0')}/${String(start.getMonth()+1).padStart(2,'0')})`,
      isCurrentWeek: i === 0 && weekOffset === 0,
      baseInflow: 0, baseOutflow: 0, simInflow: 0, simOutflow: 0,
      affectedItems: [], simItems: [] };
  });

  // Baseline inflow
  [...receivables, ...invoices].forEach(r => {
    if (r.status === 'paid' || r.status === 'written_off') return;
    const due = new Date(r.due_date);
    const w = weeks.find(w => due >= w.start && due <= w.end);
    if (w) w.baseInflow += (r.amount || 0) - (r.amount_received || r.amount_paid || 0);
  });
  // Baseline outflow
  payables.filter(p => p.status !== 'paid').forEach(p => {
    const due = new Date(p.due_date);
    const w = weeks.find(w => due >= w.start && due <= w.end);
    if (w) w.baseOutflow += (p.amount || 0) - (p.amount_paid || 0);
  });
  // Add expenses to base outflow
  weeks.forEach(w => { w.baseOutflow += Math.round(totalExpPerWeek); });

  // Simulated — start from baseline, apply adjustments
  weeks.forEach(w => { w.simInflow = w.baseInflow; w.simOutflow = w.baseOutflow; });

  // Apply receivable adjustments
  adjustments.receivables.forEach((adj, id) => {
    const item = [...receivables, ...invoices].find(r => r.id === id);
    if (!item) return;
    const originalAmt = (item.amount || 0) - (item.amount_received || item.amount_paid || 0);
    // Remove from original week
    const origDue = new Date(item.due_date);
    const origWeek = weeks.find(w => origDue >= w.start && origDue <= w.end);
    if (origWeek) { origWeek.simInflow -= originalAmt; }
    // Add tranches
    adj.tranches.forEach(t => {
      const td = new Date(t.date);
      const tw = weeks.find(w => td >= w.start && td <= w.end);
      if (tw) { tw.simInflow += t.amount; tw.simItems.push({ label: item.customer_name || item.debtor_name || 'Invoice', amount: t.amount, type: 'inflow', split: adj.tranches.length > 1 }); }
    });
    // Remainder stays on original date
    if (adj.remainder > 0 && origWeek) { origWeek.simInflow += adj.remainder; }
  });

  // Apply payable adjustments
  adjustments.payables.forEach((adj, id) => {
    const item = payables.find(p => p.id === id);
    if (!item) return;
    const originalAmt = (item.amount || 0) - (item.amount_paid || 0);
    const origDue = new Date(item.due_date);
    const origWeek = weeks.find(w => origDue >= w.start && origDue <= w.end);
    if (origWeek) { origWeek.simOutflow -= originalAmt; }
    adj.tranches.forEach(t => {
      const td = new Date(t.date);
      const tw = weeks.find(w => td >= w.start && td <= w.end);
      if (tw) { tw.simOutflow += t.amount; tw.simItems.push({ label: item.vendor_name || 'Payable', amount: t.amount, type: 'outflow', split: adj.tranches.length > 1 }); }
    });
    if (adj.remainder > 0 && origWeek) { origWeek.simOutflow += adj.remainder; }
  });

  // Apply hypotheticals
  hypotheticals.forEach(h => {
    h.tranches.forEach(t => {
      const td = new Date(t.date);
      const tw = weeks.find(w => td >= w.start && td <= w.end);
      if (tw) {
        if (h.type === 'inflow') { tw.simInflow += t.amount; tw.simItems.push({ label: h.label, amount: t.amount, type: 'inflow', hypo: true }); }
        else { tw.simOutflow += t.amount; tw.simItems.push({ label: h.label, amount: t.amount, type: 'outflow', hypo: true }); }
      }
    });
  });

  let baseRunning = openingBalance, simRunning = openingBalance;
  return weeks.map(w => {
    const baseNet = w.baseInflow - w.baseOutflow;
    const simNet  = w.simInflow  - w.simOutflow;
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
  const { data: bankAccounts = [] }      = useQuery({ queryKey: ['bankAccounts'],      queryFn: () => base44.entities.BankAccount.list() });

  // adjustments: Map<id, { tranches: [{amount,date}], remainder: number }>
  const [recAdj, setRecAdj]     = useState(new Map());
  const [payAdj, setPayAdj]     = useState(new Map());
  const [hypotheticals, setHypo] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const adjustments = useMemo(() => ({ receivables: recAdj, payables: payAdj }), [recAdj, payAdj]);

  const weeklyData = useMemo(() =>
    buildWeeklyData(receivables, invoices, collectionTargets, payables, expenses, bankAccounts, adjustments, hypotheticals),
    [receivables, invoices, collectionTargets, payables, expenses, bankAccounts, adjustments, hypotheticals]
  );

  const baseNet12W = weeklyData.reduce((s, w) => s + w.baseNet, 0);
  const simNet12W  = weeklyData.reduce((s, w) => s + w.simNet, 0);
  const improvement = simNet12W - baseNet12W;

  const resetAll = useCallback(() => { setRecAdj(new Map()); setPayAdj(new Map()); setHypo([]); }, []);

  const totalAdjCount = recAdj.size + payAdj.size + hypotheticals.length;

  return (
    <div className="flex flex-col min-h-0">
      <PageHeader
        title="Cash Flow Simulator"
        subtitle="Model what-if scenarios by adjusting receivable and payable dates, splitting payments, and simulating funding sources."
      />

      {/* Sticky impact bar */}
      <SimImpactBar baseNet={baseNet12W} simNet={simNet12W} improvement={improvement} onReset={resetAll} />

      {/* Two-panel layout */}
      <div className="flex gap-5 mt-4 items-start">
        {/* Left panel */}
        <div className="w-[35%] shrink-0 space-y-4 overflow-y-auto max-h-[calc(100vh-220px)] pb-6 pr-1">
          <SimSectionA
            receivables={receivables}
            invoices={invoices}
            adjustments={recAdj}
            setAdjustments={setRecAdj}
          />
          <SimSectionB
            payables={payables}
            adjustments={payAdj}
            setAdjustments={setPayAdj}
          />
          <SimSectionC
            hypotheticals={hypotheticals}
            setHypotheticals={setHypo}
          />
          <SimAdjustmentDrawer
            open={drawerOpen}
            onToggle={() => setDrawerOpen(v => !v)}
            recAdj={recAdj} setRecAdj={setRecAdj}
            payAdj={payAdj} setPayAdj={setPayAdj}
            hypotheticals={hypotheticals} setHypo={setHypo}
            receivables={[...receivables, ...invoices]}
            payables={payables}
            count={totalAdjCount}
          />
        </div>

        {/* Right panel */}
        <div className="flex-1 space-y-4 sticky top-4">
          <SimChart weeklyData={weeklyData} />
          <SimTable weeklyData={weeklyData} bankAccounts={bankAccounts} />
          <p className="text-xs text-muted-foreground text-center pb-4">
            ⚠ Simulated adjustments do not affect actual due dates or records in Receivables or Payables. All figures are for planning purposes only.
          </p>
        </div>
      </div>
    </div>
  );
}