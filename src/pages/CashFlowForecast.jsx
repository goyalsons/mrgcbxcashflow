import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR } from '@/lib/utils/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';

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

const INR_FMT = (v) => `₹${(Math.abs(v)/1000).toFixed(0)}K`;

export default function CashFlowForecast() {
  const { data: receivables = [] } = useQuery({ queryKey: ['receivables'], queryFn: () => base44.entities.Receivable.list() });
  const { data: payables = [] } = useQuery({ queryKey: ['payables'], queryFn: () => base44.entities.Payable.list() });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => base44.entities.Expense.list() });
  const { data: bankAccounts = [] } = useQuery({ queryKey: ['bankAccounts'], queryFn: () => base44.entities.BankAccount.list() });

  const openingBalance = bankAccounts.reduce((s, a) => s + (a.balance || 0), 0);

  const weeklyData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weeks = Array.from({ length: 12 }, (_, i) => {
      const start = addDays(today, i * 7);
      const end = addDays(today, (i + 1) * 7 - 1);
      return { start, end, label: `W${i+1} (${weekLabel(start)})`, inflow: 0, outflow: 0 };
    });

    receivables.filter(r => r.status !== 'paid' && r.status !== 'written_off').forEach(r => {
      const due = new Date(r.due_date);
      const w = weeks.find(w => due >= w.start && due <= w.end);
      if (w) w.inflow += (r.amount || 0) - (r.amount_received || 0);
    });

    payables.filter(p => p.status !== 'paid').forEach(p => {
      const due = new Date(p.due_date);
      const w = weeks.find(w => due >= w.start && due <= w.end);
      if (w) w.outflow += (p.amount || 0) - (p.amount_paid || 0);
    });

    // Distribute avg weekly expenses
    const totalExp = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const weeklyExp = totalExp / 12;
    weeks.forEach(w => w.outflow += weeklyExp);

    let running = openingBalance;
    return weeks.map(w => {
      running += w.inflow - w.outflow;
      return { ...w, net: w.inflow - w.outflow, closing: running };
    });
  }, [receivables, payables, expenses, openingBalance]);

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
      running += m.inflow - m.outflow;
      return { ...m, net: m.inflow - m.outflow, closing: running };
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
        </TabsList>

        <TabsContent value="weekly" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Weekly Cash Flow</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weeklyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={INR_FMT} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatINR(v)} />
                  <Legend />
                  <Bar dataKey="inflow" name="Inflow" fill="hsl(var(--chart-2))" radius={[3,3,0,0]} />
                  <Bar dataKey="outflow" name="Outflow" fill="hsl(var(--chart-4))" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Running Cash Balance</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={INR_FMT} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatINR(v)} />
                  <Line type="monotone" dataKey="closing" name="Closing Balance" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week</TableHead>
                <TableHead className="text-right">Inflow</TableHead>
                <TableHead className="text-right">Outflow</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Closing Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weeklyData.map((w, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{w.label}</TableCell>
                  <TableCell className="text-right text-emerald-600">{formatINR(w.inflow)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatINR(w.outflow)}</TableCell>
                  <TableCell className={`text-right font-semibold ${w.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatINR(w.net)}</TableCell>
                  <TableCell className={`text-right font-bold ${w.closing >= 0 ? 'text-foreground' : 'text-red-600'}`}>{formatINR(w.closing)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="monthly" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Monthly Cash Flow</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={INR_FMT} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatINR(v)} />
                  <Legend />
                  <Bar dataKey="inflow" name="Inflow" fill="hsl(var(--chart-2))" radius={[3,3,0,0]} />
                  <Bar dataKey="outflow" name="Outflow" fill="hsl(var(--chart-4))" radius={[3,3,0,0]} />
                </BarChart>
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
                  <TableCell className="text-right text-emerald-600">{formatINR(m.inflow)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatINR(m.outflow)}</TableCell>
                  <TableCell className={`text-right font-semibold ${m.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatINR(m.net)}</TableCell>
                  <TableCell className={`text-right font-bold ${m.closing >= 0 ? 'text-foreground' : 'text-red-600'}`}>{formatINR(m.closing)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}