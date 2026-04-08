import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Line, ReferenceArea, ReferenceLine, Area
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Brain, ChevronLeft, ChevronRight, AlertTriangle, Flame } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import AIProjectionPanel from '@/components/cashflow/AIProjectionPanel';

function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function weekLabel(date) { const d = new Date(date); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`; }
function monthLabel(date) { return new Date(date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }); }

const fmt = (v) => Math.round(v || 0);
const INR_FMT = (v) => `₹${(Math.abs(v||0)/1000).toFixed(0)}K`;
const INR_CR = (v) => {
  const abs = Math.abs(v||0);
  if (abs >= 10000000) return `₹${(abs/10000000).toFixed(2)}Cr`;
  if (abs >= 100000)   return `₹${(abs/100000).toFixed(1)}L`;
  return `₹${abs.toLocaleString('en-IN')}`;
};
const formatINR = (v) => `₹${Math.round(Math.abs(v || 0)).toLocaleString('en-IN')}${v < 0 ? ' (Dr)' : ''}`;

const EXP_CATEGORIES = {
  salary: 'Salary', rent: 'Rent/Utilities', utilities: 'Rent/Utilities',
  travel: 'Travel', marketing: 'Marketing', software: 'Software',
  maintenance: 'Maintenance', office_supplies: 'Office & Other',
  meals: 'Office & Other', miscellaneous: 'Office & Other',
};
const EXPENSE_GROUPS = ['Salary', 'Rent/Utilities', 'Travel', 'Marketing', 'Software', 'Maintenance', 'Office & Other'];

// Custom dot that only shows label on negative net values
const NetDotWithLabel = (props) => {
  const { cx, cy, payload } = props;
  if (!payload || payload.net >= 0) return <circle cx={cx} cy={cy} r={4} fill="#1d4ed8" />;
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
      <text x={cx} y={cy - 10} textAnchor="middle" fontSize={9} fill="#ef4444" fontWeight="600">
        {INR_FMT(payload.net)}
      </text>
    </g>
  );
};

const WeeklyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload || {};
  const totalOut = data.outflow || 0;
  const net = data.net || 0;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs space-y-1 min-w-[220px]">
      <p className="font-semibold text-sm mb-2 border-b pb-1">{label}</p>
      <div className="space-y-0.5">
        <p className="font-medium text-emerald-700 mb-1">Inflows</p>
        <div className="flex justify-between"><span className="text-emerald-600">Receivables</span><span className="font-medium">{INR_FMT(data.inflowReceivables||0)}</span></div>
        <div className="flex justify-between"><span className="text-emerald-500">Invoices</span><span className="font-medium">{INR_FMT(data.inflowInvoices||0)}</span></div>
        <div className="flex justify-between"><span className="text-teal-600">Coll. Targets</span><span className="font-medium">{INR_FMT(data.inflowTargets||0)}</span></div>
      </div>
      <div className="border-t my-1 pt-1 space-y-0.5">
        <p className="font-medium text-red-700 mb-1">Outflows</p>
        <div className="flex justify-between"><span className="text-red-600">Payables</span><span className="font-medium">{INR_FMT(data.payablesOut||0)}</span></div>
        {EXPENSE_GROUPS.map(g => (data[g]||0) > 0 && (
          <div key={g} className="flex justify-between"><span className="text-slate-500">{g}</span><span className="font-medium">{INR_FMT(data[g]||0)}</span></div>
        ))}
      </div>
      <div className={`border-t pt-1 flex justify-between font-bold ${net>=0?'text-emerald-700':'text-red-700'}`}>
        <span>Net</span><span>{INR_FMT(net)}</span>
      </div>
    </div>
  );
};

const MonthlyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs space-y-1 min-w-[200px]">
      <p className="font-semibold text-sm mb-2">{label}</p>
      {payload.map((p, i) => p.value !== undefined && (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium">{INR_CR(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// Zero-inflow highlight bar shape
const MonthlyInflowBar = (props) => {
  const { x, y, width, height, value } = props;
  if (value === 0) {
    return (
      <g>
        <rect x={x} y={y} width={width} height={height || 8} fill="#fef3c7" stroke="#f59e0b" strokeWidth={2} rx={3} />
        <text x={x + width / 2} y={(y||0) - 5} textAnchor="middle" fontSize={9} fill="#d97706" fontWeight="600">⚠ 0</text>
      </g>
    );
  }
  return <rect x={x} y={y} width={width} height={height} fill="#10b981" rx={3} />;
};

export default function CashFlowForecast() {
  const [weekOffset, setWeekOffset] = useState(0);

  const { data: receivables = [] }       = useQuery({ queryKey: ['receivables'],       queryFn: () => base44.entities.Receivable.list() });
  const { data: invoices = [] }          = useQuery({ queryKey: ['invoices'],          queryFn: () => base44.entities.Invoice.list() });
  const { data: collectionTargets = [] } = useQuery({ queryKey: ['collectionTargets'], queryFn: () => base44.entities.CollectionTarget.list() });
  const { data: payables = [] }          = useQuery({ queryKey: ['payables'],          queryFn: () => base44.entities.Payable.list() });
  const { data: expenses = [] }          = useQuery({ queryKey: ['expenses'],          queryFn: () => base44.entities.Expense.list() });
  const { data: bankAccounts = [] }      = useQuery({ queryKey: ['bankAccounts'],      queryFn: () => base44.entities.BankAccount.list() });

  const openingBalance = bankAccounts.reduce((s, a) => s + (a.balance || 0), 0);

  const expByGroup = useMemo(() => {
    const grouped = {};
    EXPENSE_GROUPS.forEach(g => grouped[g] = 0);
    expenses.forEach(e => {
      const grp = EXP_CATEGORIES[e.category] || 'Office & Other';
      grouped[grp] = (grouped[grp] || 0) + (e.amount || 0);
    });
    Object.keys(grouped).forEach(k => grouped[k] = grouped[k] / 12);
    return grouped;
  }, [expenses]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const weeklyData = useMemo(() => {
    const startDay = addDays(today, weekOffset * 7);
    const weeks = Array.from({ length: 12 }, (_, i) => {
      const start = addDays(startDay, i * 7);
      const end   = addDays(startDay, (i + 1) * 7 - 1);
      const row = { start, end, label: `W${i+1+weekOffset} (${weekLabel(start)})`, isCurrentWeek: i === 0 && weekOffset === 0,
        inflowReceivables: 0, inflowInvoices: 0, inflowTargets: 0, payablesOut: 0 };
      EXPENSE_GROUPS.forEach(g => row[g] = fmt(expByGroup[g] || 0));
      return row;
    });

    receivables.filter(r => r.status !== 'paid' && r.status !== 'written_off').forEach(r => {
      const due = new Date(r.due_date);
      const w = weeks.find(w => due >= w.start && due <= w.end);
      if (w) w.inflowReceivables += (r.amount || 0) - (r.amount_received || 0);
    });
    invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'written_off').forEach(inv => {
      const due = new Date(inv.due_date);
      const w = weeks.find(w => due >= w.start && due <= w.end);
      if (w) w.inflowInvoices += (inv.amount || 0) - (inv.amount_paid || 0);
    });
    collectionTargets.forEach(ct => {
      const remaining = (ct.target_amount || 0) - (ct.collected_amount || 0);
      if (remaining <= 0) return;
      const matchingWeeks = weeks.filter(w => w.start.getMonth() + 1 === ct.period_month && w.start.getFullYear() === ct.period_year);
      if (matchingWeeks.length > 0) {
        const perWeek = remaining / matchingWeeks.length;
        matchingWeeks.forEach(w => w.inflowTargets += perWeek);
      }
    });
    payables.filter(p => p.status !== 'paid').forEach(p => {
      const due = new Date(p.due_date);
      const w = weeks.find(w => due >= w.start && due <= w.end);
      if (w) w.payablesOut += (p.amount || 0) - (p.amount_paid || 0);
    });

    let running = openingBalance;
    return weeks.map(w => {
      const totalExpOut = EXPENSE_GROUPS.reduce((s, g) => s + (w[g] || 0), 0);
      const outflow = fmt(w.payablesOut) + totalExpOut;
      const inflow = fmt(w.inflowReceivables) + fmt(w.inflowInvoices) + fmt(w.inflowTargets);
      const net = inflow - outflow;
      running += net;
      return {
        ...w,
        inflowReceivables: fmt(w.inflowReceivables),
        inflowInvoices: fmt(w.inflowInvoices),
        inflowTargets: fmt(w.inflowTargets),
        payablesOut: fmt(w.payablesOut),
        inflow, outflow, net: fmt(net), closing: fmt(running),
      };
    });
  }, [receivables, invoices, collectionTargets, payables, expByGroup, openingBalance, weekOffset, today]);

  const currentWeekLabel = weeklyData[0]?.label;

  const totalInflow12W  = weeklyData.reduce((s, w) => s + w.inflow, 0);
  const totalOutflow12W = weeklyData.reduce((s, w) => s + w.outflow, 0);
  const net12W          = totalInflow12W - totalOutflow12W;
  const avgWeeklyOutflow = totalOutflow12W / 12;
  const weeksOfRunway   = avgWeeklyOutflow > 0 ? Math.floor(openingBalance / avgWeeklyOutflow) : Infinity;

  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 3 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const end = new Date(today.getFullYear(), today.getMonth() + i + 1, 0);
      return { start: d, end, label: monthLabel(d), inflow: 0, outflow: 0 };
    });
    receivables.filter(r => r.status !== 'paid' && r.status !== 'written_off').forEach(r => {
      const due = new Date(r.due_date);
      const m = months.find(m => due >= m.start && due <= m.end);
      if (m) m.inflow += (r.amount || 0) - (r.amount_received || 0);
    });
    invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'written_off').forEach(inv => {
      const due = new Date(inv.due_date);
      const m = months.find(m => due >= m.start && due <= m.end);
      if (m) m.inflow += (inv.amount || 0) - (inv.amount_paid || 0);
    });
    collectionTargets.forEach(ct => {
      const remaining = (ct.target_amount || 0) - (ct.collected_amount || 0);
      if (remaining <= 0) return;
      const m = months.find(m => m.start.getMonth() + 1 === ct.period_month && m.start.getFullYear() === ct.period_year);
      if (m) m.inflow += remaining;
    });
    payables.filter(p => p.status !== 'paid').forEach(p => {
      const due = new Date(p.due_date);
      const m = months.find(m => due >= m.start && due <= m.end);
      if (m) m.outflow += (p.amount || 0) - (p.amount_paid || 0);
    });
    const totalExp = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    months.forEach(m => m.outflow += totalExp / 3);
    let running = openingBalance;
    return months.map((m, i) => {
      const inflow = fmt(m.inflow);
      const outflow = fmt(m.outflow);
      const net = inflow - outflow;
      running += net;
      // Confidence bands widen over time (fake ±5%, ±12%, ±22%)
      const uncertainty = [0.05, 0.12, 0.22][i] || 0.22;
      const confidenceUpper = fmt(net + Math.abs(net) * uncertainty);
      const confidenceLower = fmt(net - Math.abs(net) * uncertainty);
      return { ...m, inflow, outflow, net: fmt(net), closing: fmt(running), confidenceUpper, confidenceLower };
    });
  }, [receivables, invoices, collectionTargets, payables, expenses, openingBalance, today]);

  const zeroInflowMonths = monthlyData.filter(m => m.inflow === 0).map(m => m.label);
  const SAFE_BALANCE = 35_00_00_000; // 35Cr threshold

  const getHealth = (m) => {
    if (m.net >= 0) return { label: 'Healthy', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (m.closing >= SAFE_BALANCE) return { label: 'Caution', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'Critical', cls: 'bg-red-50 text-red-700 border-red-200' };
  };

  const totalMonthInflow  = monthlyData.reduce((s, m) => s + m.inflow, 0);
  const totalMonthOutflow = monthlyData.reduce((s, m) => s + m.outflow, 0);
  const totalMonthNet     = totalMonthInflow - totalMonthOutflow;
  const finalClosing      = monthlyData[monthlyData.length - 1]?.closing || openingBalance;

  return (
    <div className="space-y-6">
      <PageHeader title="Cash Flow Forecast" subtitle="12-week and 3-month projected cash position" />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4">
            <div className="text-xs text-blue-600 font-medium flex items-center gap-1"><Wallet className="w-3.5 h-3.5" />Opening Balance</div>
            <div className="text-xl font-bold text-blue-700 mt-0.5">{INR_CR(openingBalance)}</div>
            <div className="text-xs text-blue-400 mt-0.5">current bank balance</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-4">
            <div className="text-xs text-emerald-600 font-medium flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" />12W Expected Inflow</div>
            <div className="text-xl font-bold text-emerald-700 mt-0.5">{INR_CR(totalInflow12W)}</div>
            <div className="text-xs text-emerald-400 mt-0.5 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> receivables + invoices
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-100">
          <CardContent className="p-4">
            <div className="text-xs text-red-600 font-medium flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" />12W Expected Outflow</div>
            <div className="text-xl font-bold text-red-700 mt-0.5">{INR_CR(totalOutflow12W)}</div>
            <div className="text-xs text-red-400 mt-0.5 flex items-center gap-0.5">
              <TrendingDown className="w-3 h-3" /> payables + expenses
            </div>
          </CardContent>
        </Card>
        <Card className={net12W >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}>
          <CardContent className="p-4">
            <div className={`text-xs font-medium flex items-center gap-1 ${net12W >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {net12W >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              Net 12W Position
            </div>
            <div className={`text-xl font-bold mt-0.5 ${net12W >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{INR_CR(net12W)}</div>
            <div className={`text-xs mt-0.5 ${net12W >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {net12W >= 0 ? '▲ Surplus' : '▼ Deficit'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="weekly">
        <TabsList>
          <TabsTrigger value="weekly">12-Week View</TabsTrigger>
          <TabsTrigger value="monthly">Monthly View</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5"><Brain className="w-3.5 h-3.5" />AI Projection</TabsTrigger>
        </TabsList>

        {/* ─── WEEKLY TAB ─── */}
        <TabsContent value="weekly" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Weekly Inflow, Outflow & Net Cash Flow</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Stacked bars show breakdown by type. Line shows net cash flow.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setWeekOffset(o => o - 1)} title="Previous 12 weeks">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {weekOffset === 0 ? 'Current' : weekOffset > 0 ? `+${weekOffset}w` : `${weekOffset}w`}
                  </span>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setWeekOffset(o => o + 1)} title="Next 12 weeks">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                  {weekOffset !== 0 && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setWeekOffset(0)}>Reset</Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={380}>
                <ComposedChart data={weeklyData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  {/* Danger zone below 0 */}
                  <ReferenceArea y1={-9999999999} y2={0} fill="#ef4444" fillOpacity={0.07} />
                  {/* Today marker */}
                  {weekOffset === 0 && (
                    <ReferenceLine x={currentWeekLabel} stroke="#6366f1" strokeDasharray="4 2" strokeWidth={2}
                      label={{ value: 'Today', position: 'top', fontSize: 10, fill: '#6366f1' }} />
                  )}
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={INR_FMT} tick={{ fontSize: 10 }} />
                  <Tooltip content={<WeeklyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {/* Inflow stacked */}
                  <Bar dataKey="inflowReceivables" name="↑ Receivables" stackId="in" fill="#10b981" />
                  <Bar dataKey="inflowInvoices"    name="↑ Invoices"    stackId="in" fill="#34d399" />
                  <Bar dataKey="inflowTargets"     name="↑ Coll. Targets" stackId="in" fill="#6ee7b7" radius={[3,3,0,0]} />
                  {/* Outflow stacked */}
                  <Bar dataKey="payablesOut"       name="Payables"       stackId="out" fill="#ef4444" />
                  <Bar dataKey="Salary"            name="Salary"         stackId="out" fill="#f97316" />
                  <Bar dataKey="Rent/Utilities"    name="Rent/Utilities" stackId="out" fill="#a855f7" />
                  <Bar dataKey="Travel"            name="Travel"         stackId="out" fill="#3b82f6" />
                  <Bar dataKey="Marketing"         name="Marketing"      stackId="out" fill="#ec4899" />
                  <Bar dataKey="Software"          name="Software"       stackId="out" fill="#14b8a6" />
                  <Bar dataKey="Maintenance"       name="Maintenance"    stackId="out" fill="#84cc16" />
                  <Bar dataKey="Office & Other"    name="Office & Other" stackId="out" fill="#94a3b8" radius={[3,3,0,0]} />
                  <Line type="monotone" dataKey="net" name="Net Cash Flow" stroke="#1d4ed8" strokeWidth={2.5} dot={<NetDotWithLabel />} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Burn Rate Banner */}
          <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${weeksOfRunway <= 4 ? 'bg-red-50 border-red-200' : weeksOfRunway <= 8 ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
            <Flame className={`w-4 h-4 shrink-0 ${weeksOfRunway <= 4 ? 'text-red-600' : weeksOfRunway <= 8 ? 'text-amber-600' : 'text-blue-600'}`} />
            <p className={`text-sm ${weeksOfRunway <= 4 ? 'text-red-800' : weeksOfRunway <= 8 ? 'text-amber-800' : 'text-blue-800'}`}>
              <span className="font-semibold">Burn Rate Insight: </span>
              {weeksOfRunway === Infinity
                ? 'No outflows projected — opening balance is sufficient.'
                : `At current avg. weekly outflow of ${INR_CR(avgWeeklyOutflow)}, your opening balance of ${INR_CR(openingBalance)} covers approximately `}
              {weeksOfRunway !== Infinity && (
                <span className="font-bold">{weeksOfRunway} more week{weeksOfRunway !== 1 ? 's' : ''}.</span>
              )}
              {weeksOfRunway !== Infinity && weeksOfRunway <= 4 && <span className="font-semibold"> ⚠️ Urgent: Accelerate collections.</span>}
            </p>
          </div>

          {/* Weekly Breakdown Table */}
          <Card>
            <CardHeader><CardTitle className="text-base">Weekly Breakdown Detail</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky top-0 bg-card z-10 whitespace-nowrap">Week</TableHead>
                      <TableHead className="sticky top-0 bg-indigo-50 z-10 text-right font-bold text-indigo-700">Net</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 text-right text-emerald-700">Inflow</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 text-right text-red-700">Payables</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 text-right text-orange-600">Salary</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 text-right text-purple-600">Rent/Util</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 text-right text-blue-600">Travel</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 text-right text-pink-600">Mktg</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 text-right text-teal-600">Software</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 text-right text-slate-600">Other</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 text-right font-bold">Total Out</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 text-right font-bold">Closing</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weeklyData.map((w, i) => (
                      <TableRow key={i} className={`${w.net < 0 ? 'bg-red-50/40' : i%2===0?'bg-white':'bg-muted/20'} ${w.isCurrentWeek ? 'ring-1 ring-inset ring-indigo-300' : ''}`}>
                        <TableCell className="font-medium text-xs whitespace-nowrap">
                         {w.label}{w.isCurrentWeek && <span className="ml-1 text-indigo-500 text-xs">•</span>}
                        </TableCell>
                        <TableCell className={`text-right font-bold text-xs bg-indigo-50 ${w.net>=0?'text-emerald-700':'text-red-700'}`}>
                          {w.net>=0?'▲':'▼'} ₹{Math.abs(w.net).toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className="text-right text-emerald-600 text-xs">₹{w.inflow.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-red-600 text-xs">₹{w.payablesOut.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-orange-600 text-xs">₹{(w['Salary']||0).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-purple-600 text-xs">₹{(w['Rent/Utilities']||0).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-blue-600 text-xs">₹{(w['Travel']||0).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-pink-600 text-xs">₹{(w['Marketing']||0).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-teal-600 text-xs">₹{(w['Software']||0).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-slate-600 text-xs">₹{(w['Office & Other']||0).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-red-700 font-semibold text-xs">₹{w.outflow.toLocaleString('en-IN')}</TableCell>
                        <TableCell className={`text-right font-bold text-xs ${w.closing>=0?'text-foreground':'text-red-600'}`}>₹{Math.abs(w.closing).toLocaleString('en-IN')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── MONTHLY TAB ─── */}
        <TabsContent value="monthly" className="mt-4 space-y-4">
          {/* Zero inflow alert */}
          {zeroInflowMonths.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">No inflow recorded for {zeroInflowMonths.join(', ')}</p>
                <p className="text-xs text-amber-700 mt-0.5">Verify if receivables or collections are missing for this period.</p>
              </div>
            </div>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Monthly Cash Flow</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={monthlyData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  {/* Safe operating range band */}
                  <ReferenceArea y1={0} y2={SAFE_BALANCE} fill="#10b981" fillOpacity={0.04} />
                  <ReferenceArea y1={-9999999999} y2={0} fill="#ef4444" fillOpacity={0.07} />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={INR_FMT} tick={{ fontSize: 11 }} />
                  <Tooltip content={<MonthlyTooltip />} />
                  <Legend />
                  <Bar dataKey="inflow"  name="Inflow"  shape={<MonthlyInflowBar />} />
                  <Bar dataKey="outflow" name="Outflow" fill="#ef4444" radius={[3,3,0,0]} />
                  {/* Confidence band */}
                  <Area type="monotone" dataKey="confidenceUpper" name="Upper bound" fill="url(#confGrad)" stroke="none" />
                  <Area type="monotone" dataKey="confidenceLower" name="Lower bound" fill="#fff" stroke="none" fillOpacity={1} />
                  <Line type="monotone" dataKey="net" name="Net" stroke="#1d4ed8" strokeWidth={2.5} dot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right font-bold text-indigo-700 bg-indigo-50">Net</TableHead>
                    <TableHead className="text-right text-emerald-700">Inflow</TableHead>
                    <TableHead className="text-right text-muted-foreground">vs Prior</TableHead>
                    <TableHead className="text-right text-red-700">Outflow</TableHead>
                    <TableHead className="text-right text-muted-foreground">vs Prior</TableHead>
                    <TableHead className="text-right">Closing Balance</TableHead>
                    <TableHead className="text-center">Health</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyData.map((m, i) => {
                    const prev = monthlyData[i - 1];
                    const inflowDelta  = prev ? m.inflow  - prev.inflow  : null;
                    const outflowDelta = prev ? m.outflow - prev.outflow : null;
                    const health = getHealth(m);
                    return (
                      <TableRow key={i} className={m.inflow === 0 ? 'bg-amber-50/50' : i%2===0?'bg-white':'bg-muted/20'}>
                        <TableCell className="font-medium">{m.label}{m.inflow===0 && <span className="ml-2 text-amber-500 text-xs">⚠ no inflow</span>}</TableCell>
                        <TableCell className={`text-right font-bold bg-indigo-50 ${m.net>=0?'text-emerald-700':'text-red-700'}`}>
                          {m.net>=0?'▲':'▼'} ₹{Math.abs(m.net).toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className="text-right text-emerald-600">₹{m.inflow.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-xs">
                          {inflowDelta !== null ? (<span className={inflowDelta >= 0 ? 'text-emerald-600' : 'text-red-600'}>{inflowDelta >= 0 ? '▲' : '▼'} ₹{Math.abs(inflowDelta).toLocaleString('en-IN')}</span>) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right text-red-600">₹{m.outflow.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-xs">
                          {outflowDelta !== null ? (<span className={outflowDelta <= 0 ? 'text-emerald-600' : 'text-red-600'}>{outflowDelta <= 0 ? '▼' : '▲'} ₹{Math.abs(outflowDelta).toLocaleString('en-IN')}</span>) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${m.closing>=0?'text-foreground':'text-red-600'}`}>₹{Math.abs(m.closing).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`text-xs ${health.cls}`}>{health.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {/* Summary footer */}
              <div className="border-t bg-muted/40 px-4 py-2.5 flex flex-wrap gap-6 text-sm">
                <div><span className="text-muted-foreground text-xs">Total Inflow </span><span className="font-bold text-emerald-700">{INR_CR(totalMonthInflow)}</span></div>
                <div><span className="text-muted-foreground text-xs">Total Outflow </span><span className="font-bold text-red-700">{INR_CR(totalMonthOutflow)}</span></div>
                <div><span className="text-muted-foreground text-xs">Net </span><span className={`font-bold ${totalMonthNet>=0?'text-emerald-700':'text-red-700'}`}>{INR_CR(totalMonthNet)}</span></div>
                <div><span className="text-muted-foreground text-xs">Projected Closing </span><span className={`font-bold ${finalClosing>=0?'text-foreground':'text-red-700'}`}>{INR_CR(finalClosing)}</span></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <AIProjectionPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}