import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import SimImpactBar from '@/components/simulator/SimImpactBar';
import SimSectionA from '@/components/simulator/SimSectionA';
import SimSectionB from '@/components/simulator/SimSectionB';
import SimSectionC from '@/components/simulator/SimSectionC';
import SimSectionD, { buildSourceFlows } from '@/components/simulator/SimSectionD';
import SimZone1Chart from '@/components/simulator/SimZone1Chart';
import SimForecastChart from '@/components/simulator/SimForecastChart';
import SimTimelineBoard from '@/components/simulator/SimTimelineBoard';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, ArrowUpRight, ArrowDownRight, Brain } from 'lucide-react';
import AIProjectionPanel from '@/components/cashflow/AIProjectionPanel';
import CashFlowSimulatorMonthly from '@/pages/CashFlowSimulatorMonthly';
import SimTable from '@/components/simulator/SimTable';
import FundingSummaryCard from '@/components/simulator/FundingSummaryCard';
import ScenarioManager from '@/components/simulator/ScenarioManager';
import SimExport from '@/components/simulator/SimExport';


function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }

function getFinancialWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  let yearStart;
  if (d.getMonth() >= 3) { // April or later
    yearStart = new Date(d.getFullYear(), 3, 1); // April 1st of current year
  } else {
    yearStart = new Date(d.getFullYear() - 1, 3, 1); // April 1st of previous year
  }
  const weekNumber = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return weekNumber;
}

function getFinancialWeekStartDate(year, weekNumber) {
  const aprilFirst = new Date(year, 3, 1); // April 1st
  const dayOffset = aprilFirst.getDay();
  const weekStart = new Date(aprilFirst);
  weekStart.setDate(aprilFirst.getDate() - dayOffset + (weekNumber - 1) * 7);
  return weekStart;
}

const EXP_CATEGORIES = {
  salary: 'Salary', rent: 'Rent/Utilities', utilities: 'Rent/Utilities',
  travel: 'Travel', marketing: 'Marketing', software: 'Software',
  maintenance: 'Maintenance', office_supplies: 'Office & Other',
  meals: 'Office & Other', miscellaneous: 'Office & Other',
};
const EXPENSE_GROUPS = ['Salary', 'Rent/Utilities', 'Travel', 'Marketing', 'Software', 'Maintenance', 'Office & Other'];

export function buildWeeklyData(receivables, invoices, payables, expenses, bankAccounts, recAdj, payAdj, hypotheticals, fundingSources, levers, taxItems, collectionTargets = [], expAdj = new Map(), minAmount = 0) {
  const today = new Date(); today.setHours(0,0,0,0);
  const financialYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  
  // Use only the latest snapshot per account (same as CashFlowForecast)
  const latestByAccount = {};
  bankAccounts.forEach(a => {
    const key = a.account_number || a.name;
    const existing = latestByAccount[key];
    if (!existing || new Date(a.snapshot_date || a.created_date) > new Date(existing.snapshot_date || existing.created_date)) {
      latestByAccount[key] = a;
    }
  });
  const openingBalance = Object.values(latestByAccount).reduce((s, a) => s + (a.balance || 0), 0);

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

  // Build 52 weeks starting from April 1st (financial year)
  const weeks = Array.from({ length: 52 }, (_, i) => {
    const weekNum = i + 1;
    const start = getFinancialWeekStartDate(financialYear, weekNum);
    const end = addDays(start, 6);
    const isCurrentWeek = getFinancialWeekNumber(today) === weekNum;
    
    const row = {
      start, end,
      weekNum,
      label: `W${weekNum} (${String(start.getDate()).padStart(2,'0')}/${String(start.getMonth()+1).padStart(2,'0')})`,
      isCurrentWeek,
      baseInflow: 0, baseOutflow: 0,
      simInflow: 0, simOutflow: 0,
      fundingInflow: 0, repaymentOutflow: 0,
      simItems: [],
      // Per-category breakdown for stacked chart
      inflowReceivables: 0, inflowInvoices: 0, inflowTargets: 0, payablesOut: 0,
    };
    EXPENSE_GROUPS.forEach(g => row[g] = 0);
    return row;
  });

  // Normalize to noon to avoid UTC parse vs local midnight timezone mismatches (critical for IST)
  const inWeek = (dateStr, w) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    d.setHours(12, 0, 0, 0);
    return d >= w.start && d <= w.end;
  };

  // Helper: convert date string to week index (must match SimTimelineBoard's dueDateToWeek)
  const getWeekIndex = (dateStr) => {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    d.setHours(12, 0, 0, 0);
    const weekNum = Math.ceil(((d - (new Date(financialYear, 3, 1))) / 86400000 + 1) / 7);
    return Math.max(weekNum - 1, 0);
  };

  const filterAmt = (amt) => amt < minAmount ? 0 : amt;

  receivables.forEach(r => {
    if (['paid','written_off'].includes(r.status)) return;
    const amt = filterAmt((r.amount || 0) - (r.amount_received || r.amount_paid || 0));
    const w = weeks.find(w => inWeek(r.due_date, w));
    if (w) { w.baseInflow += amt; w.inflowReceivables += amt; }
  });
  invoices.forEach(r => {
    if (['paid','written_off'].includes(r.status)) return;
    const amt = filterAmt((r.amount || 0) - (r.amount_received || r.amount_paid || 0));
    const w = weeks.find(w => inWeek(r.due_date, w));
    if (w) { w.baseInflow += amt; w.inflowInvoices += amt; }
  });

  collectionTargets.forEach(ct => {
    const remaining = (ct.target_amount || 0) - (ct.collected_amount || 0);
    if (remaining <= 0) return;
    const matchingWeeks = weeks.filter(w => {
      const wMonth = w.start.getMonth() + 1;
      const wYear = w.start.getFullYear();
      return wMonth === ct.period_month && wYear === ct.period_year;
    });
    if (matchingWeeks.length > 0) {
      const perWeek = remaining / matchingWeeks.length;
      matchingWeeks.forEach(w => { w.baseInflow += perWeek; w.inflowTargets += perWeek; });
    }
  });

  payables.filter(p => p.status !== 'paid').forEach(p => {
    const amt = filterAmt((p.amount || 0) - (p.amount_paid || 0));
    const w = weeks.find(w => inWeek(p.due_date, w));
    if (w) { w.baseOutflow += amt; w.payablesOut += amt; }
  });
  weeks.forEach(w => { EXPENSE_GROUPS.forEach(g => { const v = Math.round(expByGroup[g] || 0); w.baseOutflow += v; w[g] += v; }); });

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
  const [currentScenarioId, setCurrentScenarioId] = useState(null);
  const [activeScenarioName, setActiveScenarioName] = useState(null);
  const [boardHistory, setBoardHistory] = useState([]);
  const [redoHistory, setRedoHistory] = useState([]);

  // Wrap setBoardHistory to clear redo on new drag action
  const pushHistory = useCallback((entry) => {
    setBoardHistory(h => [...h, entry]);
    setRedoHistory([]);
  }, []);

  const expByGroup = useMemo(() => {
    const g = {};
    EXPENSE_GROUPS.forEach(k => g[k] = 0);
    expenses.forEach(e => { const grp = EXP_CATEGORIES[e.category] || 'Office & Other'; g[grp] = (g[grp]||0) + (e.amount||0); });
    Object.keys(g).forEach(k => g[k] = g[k] / 12); // monthly avg, matches CashFlowForecast
    return g;
  }, [expenses]);

  // Memoize baseline data (static input — only recalculate if underlying entity data changes)
  const baselineInputs = useMemo(() => ({ receivables, invoices, payables, expenses, bankAccounts, collectionTargets }), [receivables, invoices, payables, expenses, bankAccounts, collectionTargets]);

  // Compute weeklyData directly (no debounce) so drag-and-drop updates are instant
  const weeklyData = useMemo(() =>
    buildWeeklyData(
      baselineInputs.receivables, baselineInputs.invoices,
      baselineInputs.payables, baselineInputs.expenses, baselineInputs.bankAccounts,
      recAdj, payAdj, hypotheticals,
      fundingSources, levers, taxItems,
      baselineInputs.collectionTargets, expAdj, 0
    ),
    [baselineInputs, recAdj, payAdj, expAdj, hypotheticals, fundingSources, levers, taxItems]
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

  const undoBoard = useCallback(() => {
    if (!boardHistory.length) return;
    const last = boardHistory[boardHistory.length - 1];
    setRedoHistory(r => [...r, { prevRecAdj: recAdj, prevPayAdj: payAdj, prevHypo: hypotheticals, prevFunding: fundingSources }]);
    setRecAdj(last.prevRecAdj);
    setPayAdj(last.prevPayAdj);
    if (last.prevHypo) setHypo(last.prevHypo);
    if (last.prevFunding) setFunding(last.prevFunding);
    setBoardHistory(h => h.slice(0, -1));
  }, [boardHistory, recAdj, payAdj, hypotheticals, fundingSources]);

  const redoBoard = useCallback(() => {
    if (!redoHistory.length) return;
    const last = redoHistory[redoHistory.length - 1];
    setBoardHistory(h => [...h, { prevRecAdj: recAdj, prevPayAdj: payAdj, prevHypo: hypotheticals, prevFunding: fundingSources }]);
    setRecAdj(last.prevRecAdj);
    setPayAdj(last.prevPayAdj);
    if (last.prevHypo) setHypo(last.prevHypo);
    if (last.prevFunding) setFunding(last.prevFunding);
    setRedoHistory(r => r.slice(0, -1));
  }, [redoHistory, recAdj, payAdj, hypotheticals, fundingSources]);

  const totalAdjCount = recAdj.size + payAdj.size + expAdj.size + hypotheticals.length + fundingSources.length + levers.length + taxItems.length;
  const hasAdjustments = totalAdjCount > 0;

  const currentState = { recAdj, payAdj, expAdj, hypotheticals, fundingSources, levers, taxItems };

  const [secCOpen, setSecCOpen] = useState(false);
  const [secDOpen, setSecDOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [bankSnapshotOpen, setBankSnapshotOpen] = useState(false);

  const INR = (v) => { const a = Math.abs(v||0); return a >= 10000000 ? `₹${(a/10000000).toFixed(1)}Cr` : a >= 100000 ? `₹${(a/100000).toFixed(1)}L` : `₹${Math.round(a).toLocaleString('en-IN')}`; };
  
  // Display only 12 weeks at a time
  const displayedWeeks = weeklyData.slice(weekOffset, weekOffset + 12);
  const totalInflow12W = displayedWeeks.reduce((s, w) => s + w.simInflow, 0);
  const totalOutflow12W = displayedWeeks.reduce((s, w) => s + w.simOutflow, 0);
  const negativeWeeks = displayedWeeks.filter(w => w.simNet < 0).length;
  const latestClosing = displayedWeeks[displayedWeeks.length - 1]?.simClosing || 0;
  const canGoBack = weekOffset > 0;
  const canGoForward = weekOffset + 12 < weeklyData.length;

  return (
    <Tabs defaultValue="weekly" className="space-y-4">
      <div className="flex items-center gap-4">
        <TabsList>
          <TabsTrigger value="weekly">Weekly (12W)</TabsTrigger>
          <TabsTrigger value="monthly">Monthly (6M)</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5"><Brain className="w-3.5 h-3.5" />AI Projection</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="weekly" className="mt-0">
    <div className="space-y-4 overflow-x-hidden max-w-full">
      {/* Weekly Stat Cards — 8 in a single row */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-1.5">
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-2">
            <div className="text-[10px] text-blue-600 font-medium flex items-center gap-0.5"><Wallet className="w-2.5 h-2.5" />Opening Bal</div>
            <div className="text-sm font-bold text-blue-700 mt-0.5 truncate">{INR(weeklyData[0]?.simClosing - weeklyData[0]?.simNet || 0)}</div>
            <div className="text-[10px] text-blue-400">bank balance</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-2">
            <div className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5"><TrendingUp className="w-2.5 h-2.5" />12W Inflow</div>
            <div className="text-sm font-bold text-emerald-700 mt-0.5 truncate">{INR(totalInflow12W)}</div>
            <div className="text-[10px] text-emerald-400 truncate">base: {INR(weeklyData.reduce((s,w)=>s+w.baseInflow,0))}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-100">
          <CardContent className="p-2">
            <div className="text-[10px] text-red-600 font-medium flex items-center gap-0.5"><TrendingDown className="w-2.5 h-2.5" />12W Outflow</div>
            <div className="text-sm font-bold text-red-700 mt-0.5 truncate">{INR(totalOutflow12W)}</div>
            <div className="text-[10px] text-red-400 truncate">base: {INR(weeklyData.reduce((s,w)=>s+w.baseOutflow,0))}</div>
          </CardContent>
        </Card>
        <Card className={simNet12W >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}>
          <CardContent className="p-2">
            <div className={`text-[10px] font-medium flex items-center gap-0.5 ${simNet12W >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {simNet12W >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}Net 12W
            </div>
            <div className={`text-sm font-bold mt-0.5 truncate ${simNet12W >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{INR(simNet12W)}</div>
            <div className="text-[10px] text-muted-foreground truncate">{negativeWeeks > 0 ? `${negativeWeeks}wk neg` : 'All positive'}</div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100">
          <CardContent className="p-2">
            <div className="text-[10px] text-purple-600 font-medium">Improvement</div>
            <div className={`text-sm font-bold mt-0.5 truncate ${improvement >= 0 ? 'text-purple-700' : 'text-red-700'}`}>{improvement >= 0 ? '+' : ''}{INR(improvement)}</div>
            <div className="text-[10px] text-purple-400">vs baseline</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-100">
          <CardContent className="p-2">
            <div className="text-[10px] text-slate-600 font-medium">Proj Closing</div>
            <div className={`text-sm font-bold mt-0.5 truncate ${latestClosing >= 0 ? 'text-slate-700' : 'text-red-700'}`}>{INR(latestClosing)}</div>
            <div className="text-[10px] text-slate-400">end of W12</div>
          </CardContent>
        </Card>
        <Card className={negativeWeeks > 4 ? 'bg-red-50 border-red-200' : negativeWeeks > 0 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}>
          <CardContent className="p-2">
            <div className={`text-[10px] font-medium flex items-center gap-0.5 ${negativeWeeks > 4 ? 'text-red-600' : negativeWeeks > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              <AlertTriangle className="w-2.5 h-2.5" />Gap Weeks
            </div>
            <div className={`text-sm font-bold mt-0.5 ${negativeWeeks > 4 ? 'text-red-700' : negativeWeeks > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{negativeWeeks} / 12</div>
            <div className="text-[10px] text-muted-foreground">neg net weeks</div>
          </CardContent>
        </Card>
        <Card className="bg-indigo-50 border-indigo-100">
          <CardContent className="p-2">
            <div className="text-[10px] text-indigo-600 font-medium">Avg Weekly Net</div>
            <div className={`text-sm font-bold mt-0.5 truncate ${(simNet12W/12) >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>{INR(Math.round(simNet12W/12))}</div>
            <div className="text-[10px] text-indigo-400">per week</div>
          </CardContent>
        </Card>
      </div>
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Cash Flow Simulator</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Model what-if scenarios — drag to reschedule, add funding sources and hypothetical entries.</p>
          {activeScenarioName && <p className="text-xs text-primary mt-0.5 font-medium">Active scenario: {activeScenarioName}</p>}
          <div className="flex items-center gap-2 mt-2">
            <Button variant="outline" size="sm" disabled={!canGoBack} onClick={() => setWeekOffset(Math.max(0, weekOffset - 12))}>&larr; Previous 12W</Button>
            <span className="text-xs text-muted-foreground whitespace-nowrap">W{displayedWeeks[0]?.weekNum || 1}-W{displayedWeeks[displayedWeeks.length - 1]?.weekNum || 12}</span>
            <Button variant="outline" size="sm" disabled={!canGoForward} onClick={() => setWeekOffset(Math.min(weeklyData.length - 12, weekOffset + 12))}>Next 12W &rarr;</Button>
          </div>
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

      {/* Forecast-style chart: Weekly Inflow / Outflow / Net */}
      <div className="mt-4">
        <SimForecastChart weeklyData={displayedWeeks} />
      </div>

      {/* Zone 1: Collapsible chart (Simulated Cash Flow) */}
      <div className="mt-4">
        <SimZone1Chart weeklyData={displayedWeeks} hasAdjustments={hasAdjustments} bankAccounts={bankAccounts} />
      </div>

      {/* Hypothetical Entries & Funding — side by side, above the board */}
      <div className="mt-4 flex gap-2">
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

      {/* Bank & Cash Snapshot (collapsed by default) */}
      {bankAccounts.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-slate-50 border-blue-100">
          <button
            onClick={() => setBankSnapshotOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-100/30 transition-colors"
          >
            <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-600" />
              Bank & Cash Accounts Snapshot
            </div>
            <span className="text-xs text-slate-600">{bankSnapshotOpen ? '▲' : '▼'}</span>
          </button>
          {bankSnapshotOpen && (
            <CardContent className="p-4 border-t border-blue-100">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {bankAccounts.map((account) => (
                  <div key={account.id} className="bg-white rounded-lg border border-blue-100 p-2.5">
                    <p className="text-[11px] text-muted-foreground font-medium truncate">{account.name}</p>
                    <p className="text-sm font-bold text-foreground mt-1">{INR(account.balance || 0)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{account.snapshot_date || 'Current'}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Zone 2: Drag-and-drop board */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-semibold">Timeline Board</h2>
            <span className="text-xs text-muted-foreground">
              (Base: <span className={`font-semibold ${baseNet12W >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{baseNet12W < 0 ? '-' : ''}{(() => { const abs = Math.abs(baseNet12W); return abs >= 10000000 ? `₹${(abs/10000000).toFixed(1)}Cr` : abs >= 100000 ? `₹${(abs/100000).toFixed(1)}L` : `₹${Math.round(abs).toLocaleString('en-IN')}`; })()}</span>
              {' → '}Sim: <span className={`font-semibold ${simNet12W >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{simNet12W < 0 ? '-' : ''}{(() => { const abs = Math.abs(simNet12W); return abs >= 10000000 ? `₹${(abs/10000000).toFixed(1)}Cr` : abs >= 100000 ? `₹${(abs/100000).toFixed(1)}L` : `₹${Math.round(abs).toLocaleString('en-IN')}`; })()}</span>)
            </span>
          </div>
          <p className="text-xs text-muted-foreground hidden sm:block">Drag cards between weeks to reschedule payments</p>
        </div>
        <div className="overflow-x-auto -mx-5 md:mx-0 px-5 md:px-0">
        <SimTimelineBoard
          receivables={receivables}
          invoices={invoices}
          payables={payables}
          expenses={expenses}
          recurringExpenses={recurringExpenses}
          hypotheticals={hypotheticals}
          fundingSources={fundingSources}
          setHypotheticals={setHypo}
          setFundingSources={setFunding}
          recAdj={recAdj}
          setRecAdj={setRecAdj}
          payAdj={payAdj}
          setPayAdj={setPayAdj}
          expAdj={expAdj}
          setExpAdj={setExpAdj}
          weeklyData={displayedWeeks}
          history={boardHistory}
          setHistory={pushHistory}
          onReset={resetAll}
          onUndo={undoBoard}
          onRedo={redoBoard}
        />
        </div>
      </div>

      {/* Funding summary */}
      <FundingSummaryCard weeklyData={displayedWeeks} />

      {/* Disclaimer */}
      <div className="mt-6 pt-4 border-t">
        <p className="text-[11px] text-muted-foreground text-center leading-relaxed max-w-4xl mx-auto">
          All simulations are for planning purposes only. This tool does not modify any actual records in your system.
        </p>
      </div>

    </div>
      </TabsContent>
      <TabsContent value="monthly" className="mt-0">
        <CashFlowSimulatorMonthly />
      </TabsContent>
      <TabsContent value="ai" className="mt-0">
        <AIProjectionPanel />
      </TabsContent>
    </Tabs>
  );
}