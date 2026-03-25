import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ArrowDownLeft, ArrowUpRight, Receipt } from 'lucide-react';
import { formatINR, formatDateIN } from '@/lib/utils/currency';
import StatusBadge from '@/components/shared/StatusBadge';

export default function RecentTransactions({ receivables, payables, expenses }) {
  // Combine and sort by date, take latest 8
  const items = [
    ...receivables.map(r => ({ type: 'receivable', name: r.customer_name, amount: r.amount, date: r.invoice_date, status: r.status })),
    ...payables.map(p => ({ type: 'payable', name: p.vendor_name, amount: p.amount, date: p.bill_date, status: p.status })),
    ...expenses.map(e => ({ type: 'expense', name: e.description, amount: e.amount, date: e.expense_date, status: e.approved ? 'paid' : 'pending' })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

  const typeIcons = {
    receivable: <ArrowDownLeft className="w-4 h-4 text-emerald-500" />,
    payable: <ArrowUpRight className="w-4 h-4 text-red-500" />,
    expense: <Receipt className="w-4 h-4 text-amber-500" />,
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">No transactions yet</p>
          )}
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b last:border-0">
              <div className="p-2 rounded-lg bg-muted">
                {typeIcons[item.type]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">{formatDateIN(item.date)}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${item.type === 'receivable' ? 'text-emerald-600' : 'text-foreground'}`}>
                  {item.type === 'receivable' ? '+' : '-'}{formatINR(item.amount)}
                </p>
                <StatusBadge status={item.status} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}