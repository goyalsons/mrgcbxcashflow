import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { formatINR } from '@/lib/utils/currency';
import { differenceInDays } from 'date-fns';

const BUCKETS = [
  { label: 'Current', min: -Infinity, max: 0, color: 'hsl(160, 84%, 39%)' },
  { label: '1–30 days', min: 1, max: 30, color: 'hsl(38, 92%, 50%)' },
  { label: '31–60 days', min: 31, max: 60, color: 'hsl(25, 95%, 55%)' },
  { label: '61–90 days', min: 61, max: 90, color: 'hsl(0, 84%, 60%)' },
  { label: '90+ days', min: 91, max: Infinity, color: 'hsl(0, 72%, 45%)' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold mb-1">{label}</p>
      <p style={{ color: payload[0]?.fill }}>Outstanding: {formatINR(payload[0]?.value)}</p>
      <p className="text-muted-foreground mt-0.5">{payload[0]?.payload?.count} invoices</p>
    </div>
  );
};

export default function OutstandingReceivablesChart({ receivables = [] }) {
  const today = new Date();

  const bucketData = BUCKETS.map(bucket => {
    const items = receivables.filter(r => {
      if (r.status === 'paid' || r.status === 'written_off') return false;
      const overdueDays = differenceInDays(today, new Date(r.due_date));
      return overdueDays >= bucket.min && overdueDays <= bucket.max;
    });
    const amount = items.reduce((s, r) => s + ((r.amount || 0) - (r.amount_received || 0)), 0);
    return { name: bucket.label, Outstanding: amount, count: items.length, color: bucket.color };
  });

  const totalOutstanding = bucketData.reduce((s, b) => s + b.Outstanding, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-semibold">Outstanding Receivables by Age</CardTitle>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total Outstanding</p>
            <p className="text-sm font-bold text-red-600">{formatINR(totalOutstanding)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bucketData} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Outstanding" radius={[4, 4, 0, 0]}>
                {bucketData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}