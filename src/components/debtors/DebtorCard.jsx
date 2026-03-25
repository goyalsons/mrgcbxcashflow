import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/utils/currency';
import { ChevronDown, ChevronUp, Phone, Mail, User, Eye } from 'lucide-react';

const PAYMENT_STATUS = (outstanding, total) => {
  if (!total || total === 0) return null;
  if (outstanding <= 0) return { label: 'Paid', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  const pct = ((total - outstanding) / total) * 100;
  if (pct > 0) return { label: 'Partial', color: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Unpaid', color: 'bg-red-50 text-red-700 border-red-200' };
};

export default function DebtorCard({ debtor, onClick }) {
  const outstanding = debtor.total_outstanding || 0;
  const invoiced = debtor.total_invoiced || 0;
  const received = debtor.total_received || 0;
  const status = PAYMENT_STATUS(outstanding, invoiced);
  const pctPaid = invoiced > 0 ? Math.min(100, ((received / invoiced) * 100)) : 0;

  const barColor = outstanding <= 0 ? 'bg-emerald-500' : pctPaid > 0 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow duration-200 border-l-4"
      style={{ borderLeftColor: outstanding <= 0 ? '#10b981' : pctPaid > 0 ? '#f59e0b' : '#ef4444' }}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground truncate">{debtor.name}</h3>
              {status && (
                <Badge variant="outline" className={`text-xs font-medium ${status.color} flex-shrink-0`}>
                  {status.label}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground mb-3">
              {debtor.contact_person && <span className="flex items-center gap-1"><User className="w-3 h-3" />{debtor.contact_person}</span>}
              {debtor.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{debtor.phone}</span>}
              {debtor.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{debtor.email}</span>}
            </div>
            {/* Progress bar */}
            <div className="w-full bg-muted rounded-full h-1.5 mb-2">
              <div className={`h-1.5 rounded-full ${barColor} transition-all`} style={{ width: `${pctPaid}%` }} />
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg font-bold text-foreground">{formatINR(outstanding)}</div>
            <div className="text-xs text-muted-foreground">of {formatINR(invoiced)}</div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="flex gap-3 text-xs text-muted-foreground">
            {debtor.assigned_manager && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-primary" />
                <span className="text-primary font-medium">{debtor.assigned_manager}</span>
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" className="text-xs h-6 px-2 gap-1">
            <Eye className="w-3 h-3" /> View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}