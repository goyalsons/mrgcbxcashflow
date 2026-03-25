import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { formatINR } from '@/lib/utils/currency';

const STATUS_COLORS = {
  pending: '#f59e0b',
  partially_paid: '#3b82f6',
  overdue: '#ef4444',
  written_off: '#9ca3af',
};

export default function OutstandingByStatusChart({ receivables }) {
  const chartData = useMemo(() => {
    const statusMap = {
      pending: 0,
      partially_paid: 0,
      overdue: 0,
      written_off: 0,
    };

    receivables.forEach(r => {
      const balance = (r.amount || 0) - (r.amount_received || 0);
      if (balance > 0) {
        const status = r.status || 'pending';
        if (statusMap.hasOwnProperty(status)) {
          statusMap[status] += balance;
        }
      }
    });

    return Object.entries(statusMap)
      .filter(([_, value]) => value > 0)
      .map(([status, value]) => ({
        name: status.replace('_', ' ').toUpperCase(),
        value,
        status,
      }));
  }, [receivables]);

  const totalOutstanding = chartData.reduce((sum, d) => sum + d.value, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload[0]) {
      return (
        <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
          <p className="text-sm font-semibold">{payload[0].name}</p>
          <p className="text-sm font-bold text-foreground">{formatINR(payload[0].value)}</p>
          <p className="text-xs text-muted-foreground">
            {((payload[0].value / totalOutstanding) * 100).toFixed(1)}%
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
          <CardTitle className="text-base">Outstanding by Status</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
          No outstanding receivables
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Outstanding by Status</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">Total: {formatINR(totalOutstanding)}</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, value }) => `${name}: ${formatINR(value)}`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#8884d8'} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}