import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatINR } from '@/lib/utils/currency';
import { subMonths, getMonth, getYear, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';

export default function MonthlyTrendsChart({ receivables, payments }) {
  const chartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      months.push({
        month: date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        startDate: startOfMonth(date),
        endDate: endOfMonth(date),
        invoiced: 0,
        collected: 0,
      });
    }

    // Sum invoices per month
    receivables.forEach(r => {
      const invoiceDate = r.invoice_date ? new Date(r.invoice_date) : null;
      if (invoiceDate) {
        months.forEach(m => {
          if (isWithinInterval(invoiceDate, { start: m.startDate, end: m.endDate })) {
            m.invoiced += r.amount || 0;
          }
        });
      }
    });

    // Sum payments per month
    payments.forEach(p => {
      const paymentDate = p.payment_date ? new Date(p.payment_date) : null;
      if (paymentDate) {
        months.forEach(m => {
          if (isWithinInterval(paymentDate, { start: m.startDate, end: m.endDate })) {
            m.collected += p.amount || 0;
          }
        });
      }
    });

    return months;
  }, [receivables, payments]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload) {
      return (
        <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
          <p className="text-sm font-semibold">{payload[0]?.payload.month}</p>
          {payload.map((entry, idx) => (
            <p key={idx} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatINR(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Monthly Invoices vs Collections (6M)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="invoiced" fill="#3b82f6" name="Invoiced" radius={[8, 8, 0, 0]} />
            <Bar dataKey="collected" fill="#10b981" name="Collected" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}