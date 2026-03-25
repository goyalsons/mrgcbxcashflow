import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatINR } from '@/lib/utils/currency';
import { eachMonthOfInterval, eachWeekOfInterval, format, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';

function buildData(debtors, payments, dateRange) {
  const { from, to, preset } = dateRange || {};
  if (!from || !to) return [];

  const useWeeks = preset === 'this_week' || preset === 'last_week';

  if (useWeeks) {
    const days = [];
    const cur = new Date(from);
    while (cur <= to) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return days.map(day => {
      const key = format(day, 'yyyy-MM-dd');
      const collected = payments
        .filter(p => (p.payment_date || '').startsWith(key))
        .reduce((s, p) => s + (p.amount || 0), 0);
      return { name: format(day, 'EEE d'), Collected: collected };
    });
  }

  const months = eachMonthOfInterval({ start: from, end: to });
  return months.map(month => {
    const key = format(month, 'yyyy-MM');
    const collected = payments
      .filter(p => (p.payment_date || '').startsWith(key))
      .reduce((s, p) => s + (p.amount || 0), 0);
    return { name: format(month, 'MMM yy'), Collected: collected };
  });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {formatINR(p.value)}</p>
      ))}
    </div>
  );
};

export default function CollectionTrendsChart({ payments = [], debtors = [], dateRange }) {
  const data = buildData(debtors, payments, dateRange);
  const total = data.reduce((s, d) => s + d.Collected, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-semibold">Collection Trends</CardTitle>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total Collected</p>
            <p className="text-sm font-bold text-emerald-600">{formatINR(total)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="collectedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Collected" stroke="hsl(160, 84%, 39%)" fill="url(#collectedGradient)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}