import React, { useMemo } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { addDays, startOfDay, format } from 'date-fns';
import { formatINR } from '@/lib/utils/currency';

export default function ProjectedCashFlow4Weeks({ receivables = [], payables = [], expenses = [] }) {
  const data = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 4 }, (_, i) => {
      const weekStart = addDays(today, i * 7);
      const weekEnd = addDays(weekStart, 6);
      const label = `Wk ${format(weekStart, 'MMM d')}`;

      const inflow = receivables
        .filter(r => {
          if (r.status === 'paid' || r.status === 'written_off') return false;
          const due = new Date(r.due_date);
          return due >= weekStart && due <= weekEnd;
        })
        .reduce((s, r) => s + Math.max(0, (r.amount || 0) - (r.amount_received || 0)), 0);

      const outflow = [
        ...payables.filter(p => {
          if (p.status === 'paid') return false;
          const due = new Date(p.due_date);
          return due >= weekStart && due <= weekEnd;
        }).map(p => Math.max(0, (p.amount || 0) - (p.amount_paid || 0))),
        ...expenses.filter(e => {
          const d = new Date(e.expense_date);
          return d >= weekStart && d <= weekEnd;
        }).map(e => e.amount || 0),
      ].reduce((s, v) => s + v, 0);

      return { label, inflow, outflow, net: inflow - outflow };
    }).reduce((acc, week) => {
      const prev = acc[acc.length - 1];
      const closing = (prev?.closing ?? 0) + week.net;
      acc.push({ ...week, closing });
      return acc;
    }, []);
  }, [receivables, payables, expenses]);

  const fmt = (v) => `₹${(v / 1000).toFixed(0)}k`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Projected Cash Flow — Next 4 Weeks</CardTitle>
        <p className="text-xs text-muted-foreground">Based on upcoming due dates</p>
      </CardHeader>
      <CardContent>
         <ResponsiveContainer width="100%" height={240}>
           <ComposedChart data={data} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
             <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
             <XAxis dataKey="label" tick={(props) => {
               const { x, y, payload } = props;
               const isNegative = data[data.findIndex(d => d.label === payload.value)]?.closing < 0;
               return (
                 <text x={x} y={y} textAnchor="middle" fontSize={11} fill={isNegative ? '#dc2626' : 'hsl(var(--foreground))'} fontWeight={isNegative ? 'bold' : 'normal'}>
                   {payload.value}
                 </text>
               );
             }} />
             <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={48} />
            <Tooltip
              formatter={(v, name) => [formatINR(v), name.charAt(0).toUpperCase() + name.slice(1)]}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="inflow" name="Inflow" fill="hsl(var(--accent))" radius={[3, 3, 0, 0]} />
            <Bar dataKey="outflow" name="Outflow" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
            <Bar dataKey="net" name="Net" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            <Line type="monotone" dataKey="closing" name="Closing Balance" stroke="#15803d" strokeWidth={2} dot={(props) => {
              const { cx, cy, payload } = props;
              const isNegative = payload && payload.closing < 0;
              return <circle cx={cx} cy={cy} r={isNegative ? 5 : 3} fill={isNegative ? '#dc2626' : '#15803d'} stroke={isNegative ? '#fff' : 'none'} strokeWidth={isNegative ? 1.5 : 0} />;
            }} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}