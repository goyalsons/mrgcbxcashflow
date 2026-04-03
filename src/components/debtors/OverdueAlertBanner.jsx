import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatINR } from '@/lib/utils/currency';

export default function OverdueAlertBanner({ overdueDebtors }) {
  if (!overdueDebtors.length) return null;
  const totalOverdue = overdueDebtors.reduce((s, d) => s + (d.total_outstanding || 0), 0);

  return (
    <div className="sticky top-0 z-20 bg-red-600 text-white px-4 py-3 rounded-lg flex items-center gap-3 shadow-md">
      <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-pulse" />
      <span className="font-bold text-sm">
        ⚠️ OVERDUE INVOICES — {overdueDebtors.length} Debtor{overdueDebtors.length !== 1 ? 's' : ''} | Amount: {formatINR(totalOverdue)}
      </span>
    </div>
  );
}