import React, { useState } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatINR } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import { Eye, Phone, Mail, CheckCircle, AlertCircle, Circle } from 'lucide-react';
import CreditStatusBadge from '@/components/shared/CreditStatusBadge';
import QuickReminderModal from './QuickReminderModal';
import QuickPaymentModal from './QuickPaymentModal';

const PAYMENT_STATUS = (outstanding, total) => {
  if (!total || total === 0) return null;
  if (outstanding <= 0) return { label: 'Paid', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', rowBg: 'bg-emerald-50/40', borderColor: '#10b981', Icon: CheckCircle };
  const pct = ((total - outstanding) / total) * 100;
  if (pct > 0) return { label: 'Partial', color: 'bg-amber-50 text-amber-700 border-amber-200', rowBg: 'bg-amber-50/40', borderColor: '#f59e0b', Icon: Circle };
  return { label: 'Unpaid', color: 'bg-red-50 text-red-700 border-red-200', rowBg: 'bg-red-50/40', borderColor: '#ef4444', Icon: AlertCircle };
};

export default function DebtorTableRow({ debtor, onClick }) {
  const [showReminder, setShowReminder] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const outstanding = debtor.total_outstanding || 0;
  const invoiced = debtor.total_invoiced || 0;
  const received = debtor.total_received || 0;
  const status = PAYMENT_STATUS(outstanding, invoiced);
  const pctPaid = invoiced > 0 ? Math.min(100, (received / invoiced) * 100) : 0;
  const barColor = outstanding <= 0 ? 'bg-emerald-500' : pctPaid > 0 ? 'bg-amber-500' : 'bg-red-500';

  const handleActionClick = (e, fn) => {
    e.stopPropagation();
    fn();
  };

  return (
    <>
      <TableRow
        className="group cursor-pointer hover:brightness-95 transition-all"
        style={{ background: status?.rowBg, borderLeft: `4px solid ${status?.borderColor || '#e5e7eb'}` }}
        onClick={onClick}
      >
        <TableCell>
          <div className="font-medium text-foreground">{debtor.name}</div>
          {debtor.contact_person && <div className="text-xs text-muted-foreground">{debtor.contact_person}</div>}
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            {debtor.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{debtor.phone}</span>}
            {debtor.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{debtor.email}</span>}
          </div>
        </TableCell>
        <TableCell className="text-right font-medium">{formatINR(invoiced)}</TableCell>
        <TableCell className="text-right text-emerald-600 font-medium">{formatINR(received)}</TableCell>
        <TableCell className="text-right font-bold">{formatINR(outstanding)}</TableCell>
        <TableCell>
          <div className="w-24">
            <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
              <span>{pctPaid.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pctPaid}%` }} />
            </div>
          </div>
        </TableCell>
        <TableCell>
          {status && (
            <Badge variant="outline" className={`text-xs font-bold min-h-[24px] gap-1 ${status.color}`}>
              <status.Icon className="w-3 h-3" />
              {status.label}
            </Badge>
          )}
        </TableCell>
        <TableCell>
          <CreditStatusBadge outstanding={outstanding} creditLimit={debtor.credit_limit} />
        </TableCell>
        <TableCell>
          {debtor.assigned_manager && (
            <span className="text-xs text-primary font-medium">{debtor.assigned_manager}</span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs px-2 gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
              onClick={(e) => handleActionClick(e, () => setShowReminder(true))}
            >
              📧 Reminder
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs px-2 gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              onClick={(e) => handleActionClick(e, () => setShowPayment(true))}
            >
              ➕ Payment
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-xs opacity-0 group-hover:opacity-100" onClick={onClick}>
              <Eye className="w-3 h-3 mr-1" /> View
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {showReminder && <QuickReminderModal debtor={debtor} onClose={() => setShowReminder(false)} />}
      {showPayment && <QuickPaymentModal debtor={debtor} onClose={() => setShowPayment(false)} />}
    </>
  );
}