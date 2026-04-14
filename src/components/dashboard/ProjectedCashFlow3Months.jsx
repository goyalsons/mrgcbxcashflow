import React, { useMemo } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { startOfMonth, endOfMonth, addMonths, format } from 'date-fns';
import { formatINR } from '@/lib/utils/currency';

export default function ProjectedCashFlow3Months({ receivables = [], payables = [], expenses = [] }) {
  const data = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 3 }, (_, i) => {
      const monthStart = startOfMonth(addMonths(today, i));
      const monthEnd = endOfMonth(monthStart);
      const label = format(monthStart, 'MMM yyyy');

      const inflow = receivables
        .filter(r => {
          if (r.status === 'paid' || r.status === 'written_off') return false;
          const due = new Date(r.due_date);
          return due >= monthStart && due <= monthEnd;
        })
        .reduce((s, r) => s + Math.max(0, (r.amount || 0) - (r.amount_received || 0)), 0);

      const outflow = [
        ...payables.filter(p => {
          if (p.status === 'paid') return false;
          const due = new Date(p.due_date);
          return due >= monthStart && due <= monthEnd;
        }).map(p => Math.max(0, (p.amount || 0) - (p.amount_paid || 0))),
        ...expenses.filter(e => {
          const d = new Date(e.expense_date);
          return d >= monthStart && d <= monthEnd;
        }).map(e => e.amount || 0),
      ].reduce((s, v) => s + v, 0);

      return { label, inflow, outflow, net: inflow - outflow };
    }).reduce((acc, month) => {
      const prev = acc[acc.length - 1];
      const closing = (prev?.closing ?? 0) + month.net;
      acc.push({ ...month, closing });
      return acc;
    }, []);
  }, [receivables, payables, expenses]);

  const fmt = (v) => `₹${(v / 100000).toFixed(1)}L`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Projected Cash Flow — Next 3 Months</CardTitle>
        <p className="text-xs text-muted-foreground">Based on upcoming due dates</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={52} />
            <Tooltip
              formatter={(v, name) => [formatINR(v), name.charAt(0).toUpperCase() + name.slice(1)]}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="inflow" name="Inflow" stroke="hsl(var(--accent))" fill="url(#inflowGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="outflow" name="Outflow" stroke="hsl(var(--destructive))" fill="url(#outflowGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="net" name="Net" stroke="hsl(var(--primary))" fill="url(#netGrad)" strokeWidth={2} />
            <Line type="monotone" dataKey="closing" name="Closing Balance" stroke="#15803d" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}