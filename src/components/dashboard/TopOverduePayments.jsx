import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatINR } from '@/lib/utils/currency';
import { AlertCircle } from 'lucide-react';
import { differenceInDays } from 'date-fns';

export default function TopOverduePayments({ receivables = [] }) {
  const top10 = useMemo(() => {
    const today = new Date();
    return receivables
      .filter(r => r.status !== 'paid' && r.status !== 'written_off' && r.due_date && new Date(r.due_date) < today)
      .map(r => ({
        ...r,
        outstanding: Math.max(0, (r.amount || 0) - (r.amount_received || 0)),
        daysOverdue: differenceInDays(today, new Date(r.due_date)),
      }))
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 10);
  }, [receivables]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-destructive" />
          Top 10 Overdue Payments
        </CardTitle>
        <p className="text-xs text-muted-foreground">Highest outstanding overdue receivables</p>
      </CardHeader>
      <CardContent className="p-0">
        {top10.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No overdue payments 🎉</p>
        ) : (
          <div className="divide-y divide-border">
            {top10.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{r.invoice_number || '—'} · {r.daysOverdue}d overdue</p>
                </div>
                <span className="text-sm font-bold text-destructive shrink-0">{formatINR(r.outstanding)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}