import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { formatINR, formatDateIN, daysUntilDue } from '@/lib/utils/currency';
import { Link } from 'react-router-dom';

export default function OverdueAlerts({ receivables, payables, debtors = [] }) {
  const overdueReceivables = receivables.filter(r => r.status === 'overdue' || (r.status === 'pending' && daysUntilDue(r.due_date) < 0));
  const overduePayables = payables.filter(p => p.status === 'overdue' || (p.status === 'pending' && daysUntilDue(p.due_date) < 0));

  const debtorByName = React.useMemo(() => {
    const map = {};
    debtors.forEach(d => { map[d.name?.toLowerCase()] = d.id; });
    return map;
  }, [debtors]);

  const all = [
    ...overdueReceivables.map(r => ({ type: 'Receivable', name: r.customer_name, amount: r.amount - (r.amount_received || 0), due: r.due_date })),
    ...overduePayables.map(p => ({ type: 'Payable', name: p.vendor_name, amount: p.amount - (p.amount_paid || 0), due: p.due_date })),
  ].sort((a, b) => new Date(a.due) - new Date(b.due));

  if (all.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Overdue Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">No overdue items. Great!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Overdue Items ({all.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {all.slice(0, 5).map((item, i) => {
            const debtorId = debtorByName[item.name?.toLowerCase()];
            return (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  {debtorId ? (
                    <Link to={`/debtors?profile=${debtorId}`} className="text-sm font-medium hover:text-primary hover:underline transition-colors">
                      {item.name}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium">{item.name}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{item.type} · Due: {formatDateIN(item.due)}</p>
                </div>
                <p className="text-sm font-semibold text-red-600">{formatINR(item.amount)}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}