import React from 'react';
import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG = {
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  partially_paid: { label: 'Partial', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  overdue: { label: 'Overdue', className: 'bg-red-50 text-red-700 border-red-200' },
  written_off: { label: 'Written Off', className: 'bg-gray-50 text-gray-700 border-gray-200' },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <Badge variant="outline" className={`${config.className} font-medium text-xs`}>
      {config.label}
    </Badge>
  );
}