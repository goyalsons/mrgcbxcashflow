import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatINR, formatDateIN } from '@/lib/utils/currency';
import { differenceInDays } from 'date-fns';

export default function AgingReport({ receivables }) {
  const chartData = useMemo(() => {
    const agingBuckets = {
      'Current (0-30)': 0,
      '31-60 Days': 0,
      '61-90 Days': 0,
      '90+ Days': 0,
    };

    const today = new Date();
    receivables.forEach(r => {
      if (r.status !== 'paid' && r.status !== 'written_off') {
        const balance = (r.amount || 0) - (r.amount_received || 0);
        if (balance > 0 && r.due_date) {
          const daysOverdue = differenceInDays(today, new Date(r.due_date));
          
          if (daysOverdue <= 0) {
            agingBuckets['Current (0-30)'] += balance;
          } else if (daysOverdue <= 30) {
            agingBuckets['Current (0-30)'] += balance;
          } else if (daysOverdue <= 60) {
            agingBuckets['31-60 Days'] += balance;
          } else if (daysOverdue <= 90) {
            agingBuckets['61-90 Days'] += balance;
          } else {
            agingBuckets['90+ Days'] += balance;
          }
        }
      }
    });

    return Object.entries(agingBuckets)
      .filter(([_, value]) => value > 0)
      .map(([bucket, value]) => ({
        bucket,
        amount: value,
      }));
  }, [receivables]);

  const totalAging = chartData.reduce((sum, d) => sum + d.amount, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload[0]) {
      return (
        <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
          <p className="text-sm font-semibold">{payload[0].payload.bucket}</p>
          <p className="text-sm font-bold text-foreground">{formatINR(payload[0].value)}</p>
          <p className="text-xs text-muted-foreground">
            {((payload[0].value / totalAging) * 100).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aging Report (Days Overdue)</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
          No overdue invoices
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Aging Report (Days Overdue)</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">Total Aging: {formatINR(totalAging)}</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="amount" fill="#ef4444" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}