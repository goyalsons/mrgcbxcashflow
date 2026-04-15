import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatINR } from '@/lib/utils/currency';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Users } from 'lucide-react';

export default function PaymentDueByManager({ receivables = [], customers = [] }) {
  const paymentDueByManager = useMemo(() => {
    const managerMap = {};

    // Build map of customer name -> account manager
    const customerManagerMap = {};
    customers.forEach(c => {
      if (c.account_manager && c.name) {
        customerManagerMap[c.name.trim().toLowerCase()] = {
          email: c.account_manager,
          name: c.account_manager_name || c.account_manager,
        };
      }
    });

    // Calculate outstanding by manager
    receivables.forEach(r => {
      if (r.status === 'paid' || r.status === 'written_off') return;
      if (!r.customer_name) return;

      const outstanding = Math.max(0, (r.amount || 0) - (r.amount_received || 0));
      if (outstanding <= 0) return;

      const customerKey = r.customer_name.trim().toLowerCase();
      const manager = customerManagerMap[customerKey];
      const managerKey = manager?.email || 'unassigned';
      const managerLabel = manager?.name || 'Unassigned';

      if (!managerMap[managerKey]) {
        managerMap[managerKey] = {
          manager: managerLabel,
          email: managerKey === 'unassigned' ? '' : managerKey,
          amount: 0,
        };
      }
      managerMap[managerKey].amount += outstanding;
    });

    return Object.values(managerMap)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10); // Show top 10 managers
  }, [receivables, customers]);

  if (paymentDueByManager.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-muted-foreground" />
            Payment Due by Account Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            No outstanding receivables assigned to account managers
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="w-5 h-5 text-muted-foreground" />
          Payment Due by Account Manager
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={paymentDueByManager} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="manager"
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 12 }}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatINR(value)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
              }}
              formatter={(value) => formatINR(value)}
              labelStyle={{ color: 'var(--foreground)' }}
            />
            <Bar
              dataKey="amount"
              fill="var(--chart-1)"
              name="Outstanding Amount"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>

        {/* Summary table below chart */}
        <div className="mt-6 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Manager Breakdown</div>
          {paymentDueByManager.map((item) => (
            <div key={item.email || 'unassigned'} className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/50 transition-colors">
              <span className="text-sm font-medium flex-1">{item.manager}</span>
              <span className="text-sm font-semibold text-primary">{formatINR(item.amount)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}