import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatINR } from '@/lib/utils/currency';
import { eachWeekOfInterval, eachMonthOfInterval, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

function buildChartData(receivables, payables, expenses, dateRange) {
  const { from, to, preset } = dateRange || {};

  // Decide granularity
  const useWeeks = preset === 'this_week' || preset === 'last_week';
  const useMonths = !useWeeks;

  if (!from || !to) return [];

  if (useWeeks) {
    // Day-by-day for a week
    const days = [];
    const cur = new Date(from);
    while (cur <= to) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return days.map(day => {
      const key = format(day, 'yyyy-MM-dd');
      const label = format(day, 'EEE d');
      const inflow = receivables
        .filter(r => (r.invoice_date || '').startsWith(key))
        .reduce((s, r) => s + (r.amount_received || 0), 0);
      const outflow = payables
        .filter(p => (p.bill_date || '').startsWith(key))
        .reduce((s, p) => s + (p.amount_paid || 0), 0)
        + expenses
          .filter(e => (e.expense_date || '').startsWith(key))
          .reduce((s, e) => s + (e.amount || 0), 0);
      return { name: label, Inflow: inflow, Outflow: outflow };
    });
  }

  // Monthly grouping
  const months = eachMonthOfInterval({ start: from, end: to });
  return months.map(month => {
    const key = format(month, 'yyyy-MM');
    const label = format(month, 'MMM yy');
    const inflow = receivables
      .filter(r => (r.invoice_date || r.due_date || '').startsWith(key))
      .reduce((s, r) => s + (r.amount_received || 0), 0);
    const outflow = payables
      .filter(p => (p.bill_date || p.due_date || '').startsWith(key))
      .reduce((s, p) => s + (p.amount_paid || 0), 0)
      + expenses
        .filter(e => (e.expense_date || '').startsWith(key))
        .reduce((s, e) => s + (e.amount || 0), 0);
    return { name: label, Inflow: inflow, Outflow: outflow };
  });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {formatINR(p.value)}</p>
      ))}
    </div>
  );
};

export default function CashFlowChart({ receivables, payables, expenses, dateRange }) {
  const data = buildChartData(receivables, payables, expenses, dateRange);

  const presetLabel = {
    this_week: 'This Week',
    this_month: 'This Month',
    last_month: 'Last Month',
    this_quarter: 'This Quarter',
    this_year: 'This Year',
    custom: 'Custom Range',
  }[dateRange?.preset] || 'Cash Flow';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Cash Flow — {presetLabel}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Inflow" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Outflow" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span className="text-xs text-muted-foreground">Inflow</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span className="text-xs text-muted-foreground">Outflow</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}