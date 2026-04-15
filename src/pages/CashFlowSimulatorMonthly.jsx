import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SimImpactBar from '@/components/simulator/SimImpactBar';
import SimSectionA from '@/components/simulator/SimSectionA';
import SimSectionB from '@/components/simulator/SimSectionB';
import SimSectionC from '@/components/simulator/SimSectionC';
import SimSectionD, { buildSourceFlows } from '@/components/simulator/SimSectionD';

import SimZone1Chart from '@/components/simulator/SimZone1Chart';
import MonthlyForecastChart from '@/components/simulator/MonthlyForecastChart';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import MonthlyTimelineBoard from '@/components/simulator/MonthlyTimelineBoard';
import FundingSummaryCard from '@/components/simulator/FundingSummaryCard';
import ScenarioManager from '@/components/simulator/ScenarioManager';
import SimExport from '@/components/simulator/SimExport';

const EXP_CATEGORIES = {
  salary: 'Salary', rent: 'Rent/Utilities', utilities: 'Rent/Utilities',
  travel: 'Travel', marketing: 'Marketing', software: 'Software',
  maintenance: 'Maintenance', office_supplies: 'Office & Other',
  meals: 'Office & Other', miscellaneous: 'Office & Other',
};
const EXPENSE_GROUPS = ['Salary', 'Rent/Utilities', 'Travel', 'Marketing', 'Software', 'Maintenance', 'Office & Other'];

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  d.setDate(1);
  return d;
}
function monthEnd(date) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return d;
}
const toDateStr = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function buildMonthlyData(
  receivables, invoices, payables, expenses, bankAccounts,
  recAdj, payAdj, hypotheticals, fundingSources, levers, taxItems,
  collectionTargets = [], expAdj = new Map()
) {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Opening balance from latest snapshot per account
  const latestByAccount = {};
  bankAccounts.forEach(a => {
    const key = a.account_number || a.name;
    const existing = latestByAccount[key];
    if (!existing || new Date(a.snapshot_date || a.created_date) > new Date(existing.snapshot_date || existing.created_date)) {
      latestByAccount[key] = a;
    }
  });
  const openingBalance = Object.values(latestByAccount).reduce((s, a) => s + (a.balance || 0), 0);

  // Monthly expense averages (same logic as weekly simulator)
  const adjustedExpenseIds = new Set(expAdj.keys());
  const expByGroup = {};
  EXPENSE_GROUPS.forEach(g => expByGroup[g] = 0);
  expenses.forEach(e => {
    if (adjustedExpenseIds.has(e.id)) return;
    const g = EXP_CATEGORIES[e.category] || 'Office & Other';
    expByGroup[g] = (expByGroup[g] || 0) + (e.amount || 0);
  });
  // expByGroup[g] is annual total → divide by 12 for monthly average
  EXPENSE_GROUPS.forEach(k => expByGroup[k] = expByGroup[k] / 12);

  // Build 6 month periods starting from current month
  const months = Array.from({ length: 6 }, (_, i) => {
    const start = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const end = monthEnd(start);
    const row = {
      start, end,
      label: `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`,
      monthKey: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      isCurrentMonth: i === 0,
      baseInflow: 0, baseOutflow: 0,
      simInflow: 0, simOutflow: 0,
      fundingInflow: 0, repaymentOutflow: 0,
      simItems: [],
      inflowReceivables: 0, inflowInvoices: 0, inflowTargets: 0, payablesOut: 0,
    };
    EXPENSE_GROUPS.forEach(g => row[g] = 0);
    return row;
  });

  const inMonth = (dateStr, m) => {
    if (!dateStr) return false;
    const d = new Date(dateStr); d.setHours(12, 0, 0, 0);
    return d >= m.start && d <= m.end;
  };

  // --- Baseline ---
  receivables.forEach(r => {
    if (['paid', 'written_off'].includes(r.status)) return;
    const amt = (r.amount || 0) - (r.amount_received || r.amount_paid || 0);
    const m = months.find(m => inMonth(r.due_date, m));
    if (m) { m.baseInflow += amt; m.inflowReceivables += amt; }
  });
  invoices.forEach(r => {
    if (['paid', 'written_off'].includes(r.status)) return;
    const amt = (r.amount || 0) - (r.amount_received || r.amount_paid || 0);
    const m = months.find(m => inMonth(r.due_date, m));
    if (m) { m.baseInflow += amt; m.inflowInvoices += amt; }
  });
  collectionTargets.forEach(ct => {
    const remaining = (ct.target_amount || 0) - (ct.collected_amount || 0);
    if (remaining <= 0) return;
    const m = months.find(m => m.start.getMonth() + 1 === ct.period_month && m.start.getFullYear() === ct.period_year);
    if (m) { m.baseInflow += remaining; m.inflowTargets += remaining; }
  });
  payables.filter(p => p.status !== 'paid').forEach(p => {
    const amt = (p.amount || 0) - (p.amount_paid || 0);
    const m = months.find(m => inMonth(p.due_date, m));
    if (m) { m.baseOutflow += amt; m.payablesOut += amt; }
  });
  months.forEach(m => {
    EXPENSE_GROUPS.forEach(g => { const v = Math.round(expByGroup[g] || 0); m.baseOutflow += v; m[g] += v; });
  });
  // Individually-deferred expenses at original dates for baseline
  expAdj.forEach((adj, id) => {
    const item = expenses.find(e => e.id === id);
    if (!item) return;
    const origMonth = months.find(m => inMonth(item.expense_date, m));
    if (origMonth) origMonth.baseOutflow += item.amount || 0;
  });

  months.forEach(m => { m.simInflow = m.baseInflow; m.simOutflow = m.baseOutflow; });

  // --- Sim adjustments ---
  expAdj.forEach((adj, id) => {
    const item = expenses.find(e => e.id === id);
    if (!item) return;
    const origMonth = months.find(m => inMonth(item.expense_date, m));
    const newMonth  = months.find(m => inMonth(adj.date, m));
    if (origMonth) origMonth.simOutflow -= item.amount || 0;
    if (newMonth)  { newMonth.simOutflow += item.amount || 0; newMonth.simItems.push({ label: item.description, amount: item.amount || 0, type: 'outflow' }); }
  });

  recAdj.forEach((adj, id) => {
    const item = [...receivables, ...invoices].find(r => r.id === id);
    if (!item) return;
    const origAmt = (item.amount || 0) - (item.amount_received || item.amount_paid || 0);
    const origMonth = months.find(m => inMonth(item.due_date, m));
    if (origMonth) origMonth.simInflow -= origAmt;
    adj.tranches.forEach(t => {
      const tm = months.find(m => inMonth(t.date, m));
      if (tm) { tm.simInflow += Number(t.amount); tm.simItems.push({ label: item.customer_name || item.debtor_name || 'Invoice', amount: Number(t.amount), type: 'inflow' }); }
    });
    if (adj.remainder > 0 && origMonth) origMonth.simInflow += adj.remainder;
  });

  payAdj.forEach((adj, id) => {
    const item = payables.find(p => p.id === id);
    if (!item) return;
    const origAmt = (item.amount || 0) - (item.amount_paid || 0);
    const origMonth = months.find(m => inMonth(item.due_date, m));
    if (origMonth) origMonth.simOutflow -= origAmt;
    adj.tranches.forEach(t => {
      const tm = months.find(m => inMonth(t.date, m));
      if (tm) { tm.simOutflow += Number(t.amount); tm.simItems.push({ label: item.vendor_name || 'Payable', amount: Number(t.amount), type: 'outflow' }); }
    });
    if (adj.remainder > 0 && origMonth) origMonth.simOutflow += adj.remainder;
  });

  hypotheticals.forEach(h => {
    h.tranches.forEach(t => {
      const tm = months.find(m => inMonth(t.date, m));
      if (tm) {
        if (h.type === 'inflow') { tm.simInflow += Number(t.amount); tm.simItems.push({ label: h.label, amount: Number(t.amount), type: 'inflow', hypo: true }); }
        else { tm.simOutflow += Number(t.amount); tm.simItems.push({ label: h.label, amount: Number(t.amount), type: 'outflow', hypo: true }); }
      }
    });
  });

  fundingSources.forEach(f => {
    const { inflows, outflows } = buildSourceFlows(f);
    inflows.forEach(inf => {
      const tm = months.find(m => inMonth(inf.date, m));
      if (tm) { tm.simInflow += inf.amount; tm.fundingInflow += inf.amount; tm.simItems.push({ label: inf.label, amount: inf.amount, type: 'inflow', funding: true }); }
    });
    outflows.forEach(out => {
      const tm = months.find(m => inMonth(out.date, m));
      if (tm) { tm.simOutflow += out.amount; tm.repaymentOutflow += out.amount; tm.simItems.push({ label: out.label, amount: out.amount, type: 'outflow', repayment: true }); }
    });
  });

  levers.forEach(l => {
    if (l.type === 'salary_defer') {
      const monthlyDeferred = Math.round((expByGroup['Salary'] || 0) * (Number(l.deferPct) || 0) / 100);
      const nMonths = Math.min(Number(l.weeks) || 0, 6); // treat weeks as months here
      for (let i = 0; i < nMonths; i++) { if (months[i]) months[i].simOutflow -= monthlyDeferred; }
    }
    if (l.type === 'owner_drawings') {
      const saving = (Number(l.current) - Number(l.reduced));
      const durMonths = Math.min(Number(l.duration || 3), 6);
      for (let i = 0; i < durMonths; i++) { if (months[i]) months[i].simOutflow -= Math.round(saving); }
    }
  });

  taxItems.forEach(t => {
    if (t.type === 'tds_refund' && t.amount) {
      const tm = months.find(m => inMonth(t.date, m));
      if (tm) { tm.simInflow += Number(t.amount); tm.fundingInflow += Number(t.amount); }
    }
    if (t.type === 'advance_tax' && t.amount) {
      const origMonth = months.find(m => inMonth(t.origDate, m));
      const newMonth  = months.find(m => inMonth(t.newDate, m));
      if (origMonth) origMonth.simOutflow -= Number(t.amount);
      if (newMonth)  newMonth.simOutflow  += Number(t.amount);
    }
  });

  let baseRunning = openingBalance, simRunning = openingBalance;
  return months.map(m => {
    const baseNet = Math.round(m.baseInflow - m.baseOutflow);
    const simNet  = Math.round(m.simInflow  - m.simOutflow);
    baseRunning += baseNet; simRunning += simNet;
    return { ...m, baseNet, simNet, baseClosing: Math.round(baseRunning), simClosing: Math.round(simRunning) };
  });
}

export default function CashFlowSimulatorMonthly() {
  const { data: receivables = [] }    = useQuery({ queryKey: ['receivables'],    queryFn: () => base44.entities.Receivable.list() });
  const { data: invoices = [] }       = useQuery({ queryKey: ['invoices'],       queryFn: () => base44.entities.Invoice.list() });
  const { data: payables = [] }       = useQuery({ queryKey: ['payables'],       queryFn: () => base44.entities.Payable.list() });
  const { data: expenses = [] }       = useQuery({ queryKey: ['expenses'],       queryFn: () => base44.entities.Expense.list() });
  const { data: collectionTargets = [] } = useQuery({ queryKey: ['collectionTargets'], queryFn: () => base44.entities.CollectionTarget.list() });
  const { data: bankAccounts = [] }   = useQuery({ queryKey: ['bankAccounts'],   queryFn: () => base44.entities.BankAccount.list() });

  const [recAdj, setRecAdj]   = useState(new Map());
  const [payAdj, setPayAdj]   = useState(new Map());
  const [expAdj, setExpAdj]   = useState(new Map());
  const [hypotheticals, setHypo]     = useState([]);
  const [fundingSources, setFunding] = useState([]);
  const [levers, setLevers]          = useState([]);
  const [taxItems, setTaxItems]      = useState([]);
  const [currentScenarioId, setCurrentScenarioId] = useState(null);
  const [activeScenarioName, setActiveScenarioName] = useState(null);
  const [boardHistory, setBoardHistory] = useState([]);
  const [redoHistory, setRedoHistory]   = useState([]);
  const [secCOpen, setSecCOpen] = useState(false);
  const [secDOpen, setSecDOpen] = useState(false);

  const pushHistory = useCallback((entry) => {
    setBoardHistory(h => [...h, entry]);
    setRedoHistory([]);
  }, []);

  const monthlyData = useMemo(() =>
    buildMonthlyData(
      receivables, invoices, payables, expenses, bankAccounts,
      recAdj, payAdj, hypotheticals, fundingSources, levers, taxItems,
      collectionTargets, expAdj
    ),
    [receivables, invoices, payables, expenses, bankAccounts, recAdj, payAdj, expAdj, hypotheticals, fundingSources, levers, taxItems, collectionTargets]
  );

  const baseNet6M = monthlyData.reduce((s, m) => s + m.baseNet, 0);
  const simNet6M  = monthlyData.reduce((s, m) => s + m.simNet,  0);
  const improvement = simNet6M - baseNet6M;

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

  const undoBoard = useCallback(() => {
    if (!boardHistory.length) return;
    const last = boardHistory[boardHistory.length - 1];
    setRedoHistory(r => [...r, { prevRecAdj: recAdj, prevPayAdj: payAdj, prevHypo: hypotheticals, prevFunding: fundingSources }]);
    setRecAdj(last.prevRecAdj); setPayAdj(last.prevPayAdj);
    if (last.prevHypo) setHypo(last.prevHypo);
    if (last.prevFunding) setFunding(last.prevFunding);
    setBoardHistory(h => h.slice(0, -1));
  }, [boardHistory, recAdj, payAdj, hypotheticals, fundingSources]);

  const redoBoard = useCallback(() => {
    if (!redoHistory.length) return;
    const last = redoHistory[redoHistory.length - 1];
    setBoardHistory(h => [...h, { prevRecAdj: recAdj, prevPayAdj: payAdj, prevHypo: hypotheticals, prevFunding: fundingSources }]);
    setRecAdj(last.prevRecAdj); setPayAdj(last.prevPayAdj);
    if (last.prevHypo) setHypo(last.prevHypo);
    if (last.prevFunding) setFunding(last.prevFunding);
    setRedoHistory(r => r.slice(0, -1));
  }, [redoHistory, recAdj, payAdj, hypotheticals, fundingSources]);

  const hasAdjustments = recAdj.size + payAdj.size + expAdj.size + hypotheticals.length + fundingSources.length + levers.length + taxItems.length > 0;
  const currentState = { recAdj, payAdj, expAdj, hypotheticals, fundingSources, levers, taxItems };

  const INR = (v) => { const a = Math.abs(v); return a >= 10000000 ? `₹${(a/10000000).toFixed(1)}Cr` : a >= 100000 ? `₹${(a/100000).toFixed(1)}L` : `₹${Math.round(a).toLocaleString('en-IN')}`; };

  const INR_S = (v) => { const a = Math.abs(v||0); return a >= 10000000 ? `₹${(a/10000000).toFixed(1)}Cr` : a >= 100000 ? `₹${(a/100000).toFixed(1)}L` : `₹${Math.round(a).toLocaleString('en-IN')}`; };
  const negativeMonths = monthlyData.filter(m => m.simNet < 0).length;
  const totalSimInflow = monthlyData.reduce((s, m) => s + m.simInflow, 0);
  const totalSimOutflow = monthlyData.reduce((s, m) => s + m.simOutflow, 0);
  const lastClosing = monthlyData[monthlyData.length - 1]?.simClosing || 0;

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Monthly Stat Cards */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Card className="bg-blue-50 border-blue-100 shrink-0 min-w-[130px]">
          <CardContent className="p-3">
            <div className="text-[10px] text-blue-600 font-medium flex items-center gap-1"><Wallet className="w-3 h-3" />Opening Bal.</div>
            <div className="text-base font-bold text-blue-700 mt-0.5">{INR_S(monthlyData[0]?.simClosing - monthlyData[0]?.simNet || 0)}</div>
            <div className="text-[10px] text-blue-400">bank balance</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100 shrink-0 min-w-[130px]">
          <CardContent className="p-3">
            <div className="text-[10px] text-emerald-600 font-medium flex items-center gap-1"><TrendingUp className="w-3 h-3" />6M Sim Inflow</div>
            <div className="text-base font-bold text-emerald-700 mt-0.5">{INR_S(totalSimInflow)}</div>
            <div className="text-[10px] text-emerald-400">base: {INR_S(monthlyData.reduce((s,m)=>s+m.baseInflow,0))}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-100 shrink-0 min-w-[130px]">
          <CardContent className="p-3">
            <div className="text-[10px] text-red-600 font-medium flex items-center gap-1"><TrendingDown className="w-3 h-3" />6M Sim Outflow</div>
            <div className="text-base font-bold text-red-700 mt-0.5">{INR_S(totalSimOutflow)}</div>
            <div className="text-[10px] text-red-400">base: {INR_S(monthlyData.reduce((s,m)=>s+m.baseOutflow,0))}</div>
          </CardContent>
        </Card>
        <Card className={`shrink-0 min-w-[130px] ${simNet6M >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <CardContent className="p-3">
            <div className={`text-[10px] font-medium flex items-center gap-1 ${simNet6M >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {simNet6M >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}Net 6M
            </div>
            <div className={`text-base font-bold mt-0.5 ${simNet6M >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{INR_S(simNet6M)}</div>
            <div className="text-[10px] text-muted-foreground">{negativeMonths > 0 ? `${negativeMonths}mo negative` : 'All positive'}</div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100 shrink-0 min-w-[130px]">
          <CardContent className="p-3">
            <div className="text-[10px] text-purple-600 font-medium">Sim Improvement</div>
            <div className={`text-base font-bold mt-0.5 ${improvement >= 0 ? 'text-purple-700' : 'text-red-700'}`}>{improvement >= 0 ? '+' : ''}{INR_S(improvement)}</div>
            <div className="text-[10px] text-purple-400">vs baseline</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-100 shrink-0 min-w-[130px]">
          <CardContent className="p-3">
            <div className="text-[10px] text-slate-600 font-medium">Proj. Closing</div>
            <div className={`text-base font-bold mt-0.5 ${lastClosing >= 0 ? 'text-slate-700' : 'text-red-700'}`}>{INR_S(lastClosing)}</div>
            <div className="text-[10px] text-slate-400">end of month 6</div>
          </CardContent>
        </Card>
        <Card className={`shrink-0 min-w-[130px] ${negativeMonths > 3 ? 'bg-red-50 border-red-200' : negativeMonths > 0 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
          <CardContent className="p-3">
            <div className={`text-[10px] font-medium flex items-center gap-1 ${negativeMonths > 3 ? 'text-red-600' : negativeMonths > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              <AlertTriangle className="w-3 h-3" />Cash Gap Mos
            </div>
            <div className={`text-base font-bold mt-0.5 ${negativeMonths > 3 ? 'text-red-700' : negativeMonths > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{negativeMonths} / 6</div>
            <div className="text-[10px] text-muted-foreground">negative months</div>
          </CardContent>
        </Card>
        <Card className="bg-indigo-50 border-indigo-100 shrink-0 min-w-[130px]">
          <CardContent className="p-3">
            <div className="text-[10px] text-indigo-600 font-medium">Avg Monthly Net</div>
            <div className={`text-base font-bold mt-0.5 ${(simNet6M/6) >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>{INR_S(Math.round(simNet6M/6))}</div>
            <div className="text-[10px] text-indigo-400">per month (sim)</div>
          </CardContent>
        </Card>
      </div>
      <div className="flex items-start justify-between gap-4 pb-4 border-b">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Cash Flow Simulator (Monthly)</h1>
          <p className="text-sm text-muted-foreground mt-0.5">6-month monthly view — model what-if scenarios, drag entries between months, add funding and hypothetical cash flows.</p>
          {activeScenarioName && <p className="text-xs text-primary mt-0.5 font-medium">Active scenario: {activeScenarioName}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <ScenarioManager
            currentState={currentState}
            onLoad={loadScenario}
            weeklyData={monthlyData}
            currentScenarioId={currentScenarioId}
            setCurrentScenarioId={setCurrentScenarioId}
          />
          <SimExport
            weeklyData={monthlyData}
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

      <SimImpactBar baseNet={baseNet6M} simNet={simNet6M} improvement={improvement} onReset={resetAll} />

      <MonthlyForecastChart monthlyData={monthlyData} />

      <SimZone1Chart weeklyData={monthlyData} />


      {/* Hypothetical entries & Funding */}
      <div className="flex gap-2">
        <div className="flex-1 border rounded-lg overflow-hidden">
          <button className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold hover:bg-muted/30 bg-card" onClick={() => setSecCOpen(v => !v)}>
            <span className="flex items-center gap-1.5">Hypothetical Entries {hypotheticals.length > 0 && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{hypotheticals.length}</span>}</span>
            <span className="text-xs">{secCOpen ? '▲' : '▼'}</span>
          </button>
          {secCOpen && <div className="p-3"><SimSectionC hypotheticals={hypotheticals} setHypotheticals={setHypo} /></div>}
        </div>
        <div className="flex-1 border rounded-lg overflow-hidden">
          <button className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold hover:bg-muted/30 bg-card" onClick={() => setSecDOpen(v => !v)}>
            <span className="flex items-center gap-1.5">External Funding Sources {fundingSources.length > 0 && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{fundingSources.length}</span>}</span>
            <span className="text-xs">{secDOpen ? '▲' : '▼'}</span>
          </button>
          {secDOpen && <div className="p-3"><SimSectionD sources={fundingSources} setSources={setFunding} receivables={[...receivables, ...invoices]} /></div>}
        </div>
      </div>

      {/* Monthly timeline board */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-semibold">Monthly Timeline Board</h2>
            <span className="text-xs text-muted-foreground">
              (Base: <span className={`font-semibold ${baseNet6M >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{INR(baseNet6M)}</span>
              {' → '}Sim: <span className={`font-semibold ${simNet6M >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{INR(simNet6M)}</span>)
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Drag cards between months to reschedule</p>
        </div>
        <div className="overflow-x-auto -mx-5 md:mx-0 px-5 md:px-0">
        <MonthlyTimelineBoard
          receivables={receivables}
          invoices={invoices}
          payables={payables}
          expenses={expenses}
          hypotheticals={hypotheticals}
          fundingSources={fundingSources}
          setHypotheticals={setHypo}
          setFundingSources={setFunding}
          recAdj={recAdj} setRecAdj={setRecAdj}
          payAdj={payAdj} setPayAdj={setPayAdj}
          monthlyData={monthlyData}
          history={boardHistory}
          setHistory={pushHistory}
          onReset={resetAll}
          onUndo={undoBoard}
          onRedo={redoBoard}
        />
        </div>
      </div>

      {/* Bank & Cash Snapshot */}
      {bankAccounts.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-slate-50 border-blue-100">
          <CardContent className="p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-600" />
              Bank & Cash Accounts Snapshot
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {bankAccounts.map((account) => (
                <div key={account.id} className="bg-white rounded-lg border border-blue-100 p-2.5">
                  <p className="text-[11px] text-muted-foreground font-medium truncate">{account.name}</p>
                  <p className="text-sm font-bold text-foreground mt-1">{INR_S(account.balance || 0)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{account.snapshot_date || 'Current'}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <FundingSummaryCard weeklyData={monthlyData} />

      <div className="pt-4 border-t">
        <p className="text-[11px] text-muted-foreground text-center leading-relaxed max-w-4xl mx-auto">
          All simulations are for planning purposes only. This tool does not modify any actual records in your system.
        </p>
      </div>
    </div>
  );
}