import React, { useState } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatINR } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import { Eye, Phone, Mail, CheckCircle, AlertCircle, Circle, Target, Bell, CreditCard } from 'lucide-react';
import CreditStatusBadge from '@/components/shared/CreditStatusBadge';
import QuickReminderModal from './QuickReminderModal';
import QuickPaymentModal from './QuickPaymentModal';
import SetTargetModal from './SetTargetModal';

function getISOWeek(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

const PAYMENT_STATUS = (outstanding, total) => {
  if (!total || total === 0) return null;
  if (outstanding <= 0) return { label: 'Paid', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', rowBg: 'bg-emerald-50/40', borderColor: '#10b981', Icon: CheckCircle };
  const pct = ((total - outstanding) / total) * 100;
  if (pct > 0) return { label: 'Partial', color: 'bg-amber-50 text-amber-700 border-amber-200', rowBg: 'bg-amber-50/40', borderColor: '#f59e0b', Icon: Circle };
  return { label: 'Unpaid', color: 'bg-red-50 text-red-700 border-red-200', rowBg: 'bg-red-50/40', borderColor: '#ef4444', Icon: AlertCircle };
};

export default function DebtorTableRow({ debtor, onClick, checked, onCheck, nextDueDate }) {
  const [showReminder, setShowReminder] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showTarget, setShowTarget] = useState(false);

  const outstanding = debtor.total_outstanding || 0;
  const invoiced = debtor.total_invoiced || 0;
  const received = debtor.total_received || 0;
  const status = PAYMENT_STATUS(outstanding, invoiced);
  const pctPaid = invoiced > 0 ? Math.min(100, (received / invoiced) * 100) : 0;
  const barColor = outstanding <= 0 ? 'bg-emerald-500' : pctPaid > 0 ? 'bg-amber-500' : 'bg-red-500';

  const isOverdue = nextDueDate && new Date(nextDueDate) < new Date();
  const dueWeek = nextDueDate ? `W${getISOWeek(nextDueDate)}` : '—';
  const dueMonth = nextDueDate ? new Date(nextDueDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—';

  return (
    <>
      <TableRow
        className="group cursor-pointer hover:brightness-95 transition-all"
        style={{ background: status?.rowBg, borderLeft: `4px solid ${status?.borderColor || '#e5e7eb'}` }}
        onClick={onClick}
      >
        <TableCell className="px-2" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={!!checked}
            onChange={onCheck}
            className="rounded border-input w-4 h-4 cursor-pointer"
          />
        </TableCell>
        <TableCell>
          <div className="font-medium text-foreground">{debtor.name}</div>
          {debtor.contact_person && <div className="text-xs text-muted-foreground">{debtor.contact_person}</div>}
        </TableCell>
        <TableCell onClick={e => e.stopPropagation()} className="gap-1 flex items-center">
          {debtor.phone && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-blue-600 hover:bg-blue-50"
              title={debtor.phone}
              onClick={() => window.open(`tel:${debtor.phone}`)}
            >
              <Phone className="w-3.5 h-3.5" />
            </Button>
          )}
          {debtor.email && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-orange-600 hover:bg-orange-50"
              title={debtor.email}
              onClick={() => window.open(`mailto:${debtor.email}`)}
            >
              <Mail className="w-3.5 h-3.5" />
            </Button>
          )}
        </TableCell>
        <TableCell className="text-right font-medium">{formatINR(invoiced)}</TableCell>
        <TableCell className="text-right text-emerald-600 font-medium">{formatINR(received)}</TableCell>
        <TableCell className="text-right font-bold">{formatINR(outstanding)}</TableCell>
        <TableCell>
          <div className="w-20">
            <div className="text-xs text-muted-foreground mb-0.5">{pctPaid.toFixed(0)}%</div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pctPaid}%` }} />
            </div>
          </div>
        </TableCell>
        <TableCell>
          {status && (
            <Badge variant="outline" className={`text-xs font-bold gap-1 ${status.color}`}>
              <status.Icon className="w-3 h-3" />{status.label}
            </Badge>
          )}
        </TableCell>
        <TableCell>
          <CreditStatusBadge outstanding={outstanding} creditLimit={debtor.credit_limit} />
        </TableCell>
        <TableCell>
          {debtor.assigned_manager && (
            <span className="text-xs text-primary font-medium">{debtor.assigned_manager.split('@')[0]}</span>
          )}
        </TableCell>
        <TableCell>
          {nextDueDate ? (
            <span className={`text-xs font-medium whitespace-nowrap ${isOverdue ? 'text-red-600 font-semibold' : 'text-foreground'}`}>
              {new Date(nextDueDate).toLocaleDateString('en-IN')}
              {isOverdue && <span className="block text-red-500">Overdue</span>}
            </span>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </TableCell>
        <TableCell>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{dueWeek}</span>
        </TableCell>
        <TableCell>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{dueMonth}</span>
        </TableCell>
        <TableCell onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:bg-blue-50"
              title="Send Reminder" onClick={() => setShowReminder(true)}
            >
              <Bell className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
              title="Record Payment" onClick={() => setShowPayment(true)}
            >
              <CreditCard className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-7 w-7 text-purple-600 hover:bg-purple-50"
              title="Set Target" onClick={() => setShowTarget(true)}
            >
              <Target className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"
              title="View Profile" onClick={onClick}
            >
              <Eye className="w-3.5 h-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {showReminder && <QuickReminderModal debtor={debtor} onClose={() => setShowReminder(false)} />}
      {showPayment && <QuickPaymentModal debtor={debtor} onClose={() => setShowPayment(false)} />}
      {showTarget && <SetTargetModal debtor={debtor} onClose={() => setShowTarget(false)} />}
    </>
  );
}