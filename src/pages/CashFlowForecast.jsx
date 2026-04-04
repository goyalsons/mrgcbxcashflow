import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, BarChart } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Brain } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import AIProjectionPanel from '@/components/cashflow/AIProjectionPanel';

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function weekLabel(date) {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

function monthLabel(date) {
  return new Date(date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

const fmt = (v) => Math.round(v || 0);
const INR_FMT = (v) => `₹${(Math.abs(v)/1000).toFixed(0)}K`;
const formatINR = (v) => `₹${Math.round(Math.abs(v || 0)).toLocaleString('en-IN')}${v < 0 ? ' (Dr)' : ''}`;

const EXP_CATEGORIES = {
  salary: 'Salary',
  rent: 'Rent/Utilities',
  utilities: 'Rent/Utilities',
  travel: 'Travel',
  marketing: 'Marketing',
  software: 'Software',
  maintenance: 'Maintenance',
  office_supplies: 'Office & Other',
  meals: 'Office & Other',
  miscellaneous: 'Office & Other',
};

const EXPENSE_GROUPS = ['Salary', 'Rent/Utilities', 'Travel', 'Marketing', 'Software', 'Maintenance', 'Office & Other'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs space-y-1 min-w-[200px]">
      <p className="font-semibold text-sm mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium">{INR_FMT(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function CashFlowForecast() {
  const { data: receivables = [] } = useQuery({ queryKey: ['receivables'], queryFn: () => base44.entities.Receivable.list() });
  const { data: payables = [] } = useQuery({ queryKey: ['payables'], queryFn: () => base44.entities.Payable.list() });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => base44.entities.Expense.list() });
  const { data: bankAccounts = [] } = useQuery({ queryKey: ['bankAccounts'], queryFn: () => base44.entities.BankAccount.list() });

  const openingBalance = bankAccounts.reduce((s, a) => s + (a.balance || 0), 0);

  // Group expenses by category for weekly distribution
  const expByGroup = useMemo(() => {
    const grouped = {};
    EXPENSE_GROUPS.forEach(g => grouped[g] = 0);
    expenses.forEach(e => {
      const grp = EXP_CATEGORIES[e.category] || 'Office & Other';
      grouped[grp] = (grouped[grp] || 0) + (e.amount || 0);
    });
    // weekly avg
    Object.keys(grouped).forEach(k => grouped[k] = grouped[k] / 12);
    return grouped;
  }, [expenses]);

  const weeklyData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weeks = Array.from({ length: 12 }, (_, i) => {
      const start = addDays(today, i * 7);
      const end = addDays(today, (i + 1) * 7 - 1);
      const row = { start, end, label: `W${i+1} (${weekLabel(start)})`, inflow: 0, payablesOut: 0 };
      EXPENSE_GROUPS.forEach(g => row[g] = fmt(expByGroup[g] || 0));
      return row;
    });

    receivables.filter(r => r.status !== 'paid' && r.status !== 'written_off').forEach(r => {
      const due = new Date(r.due_date);
      const w = weeks.find(w => due >= w.start && due <= w.end);
      if (w) w.inflow += (r.amount || 0) - (r.amount_received || 0);
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
      const inflow = fmt(w.inflow);
      const net = inflow - outflow;
      running += net;
      return { ...w, inflow, payablesOut: fmt(w.payablesOut), outflow, net: fmt(net), closing: fmt(running) };
    });
  }, [receivables, payables, expByGroup, openingBalance]);

  const monthlyData = useMemo(() => {
    const today = new Date();
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
    payables.filter(p => p.status !== 'paid').forEach(p => {
      const due = new Date(p.due_date);
      const m = months.find(m => due >= m.start && due <= m.end);
      if (m) m.outflow += (p.amount || 0) - (p.amount_paid || 0);
    });
    const totalExp = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    months.forEach(m => m.outflow += totalExp / 3);
    let running = openingBalance;
    return months.map(m => {
      const inflow = fmt(m.inflow);
      const outflow = fmt(m.outflow);
      const net = inflow - outflow;
      running += net;
      return { ...m, inflow, outflow, net: fmt(net), closing: fmt(running) };
    });
  }, [receivables, payables, expenses, openingBalance]);

  const totalInflow12W = weeklyData.reduce((s, w) => s + w.inflow, 0);
  const totalOutflow12W = weeklyData.reduce((s, w) => s + w.outflow, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Cash Flow Forecast" subtitle="12-week and 3-month projected cash position" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4">
            <div className="text-xs text-blue-600 font-medium">Opening Balance</div>
            <div className="text-xl font-bold text-blue-700 mt-0.5">{formatINR(openingBalance)}</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-4">
            <div className="text-xs text-emerald-600 font-medium flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" />12W Expected Inflow</div>
            <div className="text-xl font-bold text-emerald-700 mt-0.5">{formatINR(totalInflow12W)}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-100">
          <CardContent className="p-4">
            <div className="text-xs text-red-600 font-medium flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" />12W Expected Outflow</div>
            <div className="text-xl font-bold text-red-700 mt-0.5">{formatINR(totalOutflow12W)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="weekly">
        <TabsList>
          <TabsTrigger value="weekly">12-Week View</TabsTrigger>
          <TabsTrigger value="monthly">Monthly View</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5"><Brain className="w-3.5 h-3.5" />AI Projection</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="mt-4 space-y-4">
          {/* Single Combined Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Weekly Inflow, Outflow & Net Cash Flow</CardTitle>
              <p className="text-xs text-muted-foreground">Stacked outflows show breakdown by type. Line shows net cash flow per week.</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={360}>
                <ComposedChart data={weeklyData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={INR_FMT} tick={{ fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="inflow" name="↑ Receivables" stackId="in" fill="#10b981" radius={[3,3,0,0]} />
                  <Bar dataKey="payablesOut" name="Payables" stackId="out" fill="#ef4444" />
                  <Bar dataKey="Salary" name="Salary" stackId="out" fill="#f97316" />
                  <Bar dataKey="Rent/Utilities" name="Rent/Utilities" stackId="out" fill="#a855f7" />
                  <Bar dataKey="Travel" name="Travel" stackId="out" fill="#3b82f6" />
                  <Bar dataKey="Marketing" name="Marketing" stackId="out" fill="#ec4899" />
                  <Bar dataKey="Software" name="Software" stackId="out" fill="#14b8a6" />
                  <Bar dataKey="Maintenance" name="Maintenance" stackId="out" fill="#84cc16" />
                  <Bar dataKey="Office & Other" name="Office & Other" stackId="out" fill="#94a3b8" radius={[3,3,0,0]} />
                  <Line type="monotone" dataKey="net" name="Net Cash Flow" stroke="#1d4ed8" strokeWidth={2.5} dot={{ r: 4, fill: '#1d4ed8' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Detailed Breakdown Table */}
          <Card>
            <CardHeader><CardTitle className="text-base">Weekly Breakdown Detail</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky top-0 bg-card z-10 shadow-sm whitespace-nowrap">Week</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 shadow-sm text-right text-emerald-700">Inflow</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 shadow-sm text-right text-red-700">Payables</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 shadow-sm text-right text-orange-600">Salary</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 shadow-sm text-right text-purple-600">Rent/Util</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 shadow-sm text-right text-blue-600">Travel</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 shadow-sm text-right text-pink-600">Mktg</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 shadow-sm text-right text-teal-600">Software</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 shadow-sm text-right text-slate-600">Other</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 shadow-sm text-right font-bold">Total Out</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 shadow-sm text-right font-bold">Net</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 shadow-sm text-right font-bold">Closing Bal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weeklyData.map((w, i) => (
                      <TableRow key={i} className={w.net < 0 ? 'bg-red-50/40' : ''}>
                        <TableCell className="font-medium text-xs whitespace-nowrap">{w.label}</TableCell>
                        <TableCell className="text-right text-emerald-600 text-xs">₹{w.inflow.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-red-600 text-xs">₹{w.payablesOut.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-orange-600 text-xs">₹{(w['Salary']||0).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-purple-600 text-xs">₹{(w['Rent/Utilities']||0).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-blue-600 text-xs">₹{(w['Travel']||0).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-pink-600 text-xs">₹{(w['Marketing']||0).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-teal-600 text-xs">₹{(w['Software']||0).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-slate-600 text-xs">₹{(w['Office & Other']||0).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right text-red-700 font-semibold text-xs">₹{w.outflow.toLocaleString('en-IN')}</TableCell>
                        <TableCell className={`text-right font-bold text-xs ${w.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>₹{Math.abs(w.net).toLocaleString('en-IN')}{w.net < 0 ? ' ▼' : ' ▲'}</TableCell>
                        <TableCell className={`text-right font-bold text-xs ${w.closing >= 0 ? 'text-foreground' : 'text-red-600'}`}>₹{Math.abs(w.closing).toLocaleString('en-IN')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Monthly Cash Flow</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={INR_FMT} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="inflow" name="Inflow" fill="#10b981" radius={[3,3,0,0]} />
                  <Bar dataKey="outflow" name="Outflow" fill="#ef4444" radius={[3,3,0,0]} />
                  <Line type="monotone" dataKey="net" name="Net" stroke="#1d4ed8" strokeWidth={2.5} dot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Inflow</TableHead>
                <TableHead className="text-right">Outflow</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Closing Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyData.map((m, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{m.label}</TableCell>
                  <TableCell className="text-right text-emerald-600">₹{m.inflow.toLocaleString('en-IN')}</TableCell>
                  <TableCell className="text-right text-red-600">₹{m.outflow.toLocaleString('en-IN')}</TableCell>
                  <TableCell className={`text-right font-semibold ${m.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>₹{Math.abs(m.net).toLocaleString('en-IN')}{m.net < 0 ? ' ▼' : ' ▲'}</TableCell>
                  <TableCell className={`text-right font-bold ${m.closing >= 0 ? 'text-foreground' : 'text-red-600'}`}>₹{Math.abs(m.closing).toLocaleString('en-IN')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <AIProjectionPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}