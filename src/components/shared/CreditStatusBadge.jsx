import React from 'react';
import { Badge } from '@/components/ui/badge';
import { formatINR } from '@/lib/utils/currency';

/**
 * Returns credit status info for a debtor given outstanding and credit_limit.
 * limit = 0 means no limit set.
 */
export function getCreditStatus(outstanding, creditLimit) {
  if (!creditLimit || creditLimit <= 0) return null;
  const pct = (outstanding / creditLimit) * 100;
  if (pct > 100) return { label: 'Over Limit', color: 'bg-red-50 text-red-700 border-red-200', pct, variant: 'over' };
  if (pct >= 70) return { label: `${pct.toFixed(0)}% Used`, color: 'bg-amber-50 text-amber-700 border-amber-200', pct, variant: 'warning' };
  return { label: `${pct.toFixed(0)}% Used`, color: 'bg-emerald-50 text-emerald-700 border-emerald-200', pct, variant: 'ok' };
}

export default function CreditStatusBadge({ outstanding, creditLimit }) {
  const status = getCreditStatus(outstanding, creditLimit);
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <Badge variant="outline" className={`text-xs ${status.color}`}>
      {status.label}
    </Badge>
  );
}