import React, { useMemo } from 'react';
import { formatINR, formatDateIN } from '@/lib/utils/currency';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, Banknote } from 'lucide-react';

const TODAY = new Date().toISOString().split('T')[0];

function daysDiff(dateStr) {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr) - new Date(TODAY)) / 86400000);
}

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function StatusBadge({ promise, receivables }) {
  // Check if a payment was received after the promise was made
  const paid = receivables.some(r =>
    r.customer_name === promise.debtor_name &&
    r.amount_received > 0 &&
    r.invoice_date >= promise.follow_up_date
  );

  if (paid) {
    return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border text-xs">Kept ✓</Badge>;
  }

  const days = daysDiff(promise.promise_date);
  if (promise.promise_status === 'broken' || (days !== null && days < 0)) {
    return <Badge className="bg-red-50 text-red-700 border-red-200 border text-xs">Broken</Badge>;
  }
  if (days === 0) {
    return <Badge className="bg-orange-50 text-orange-700 border-orange-200 border text-xs">Due Today</Badge>;
  }
  if (days !== null && days <= 3) {
    return <Badge className="bg-amber-50 text-amber-700 border-amber-200 border text-xs">Due Soon</Badge>;
  }
  return <Badge className="bg-blue-50 text-blue-700 border-blue-200 border text-xs">Open</Badge>;
}

export default function PromiseToPayTracker({ followUps, receivables }) {
  const promises = useMemo(() => {
    return followUps
      .filter(f => f.outcome === 'promised_payment' && f.promise_date && f.promise_amount)
      .sort((a, b) => a.promise_date.localeCompare(b.promise_date));
  }, [followUps]);

  const { start: weekStart, end: weekEnd } = useMemo(() => getWeekBounds(), []);

  const weekPromises = useMemo(() =>
    promises.filter(p => {
      const d = new Date(p.promise_date);
      return d >= weekStart && d <= weekEnd;
    }), [promises, weekStart, weekEnd]);

  const weekPromisedTotal = weekPromises.reduce((s, p) => s + (p.promise_amount || 0), 0);

  const weekReceived = useMemo(() => {
    return receivables
      .filter(r => {
        if (!r.invoice_date) return false;
        const d = new Date(r.invoice_date);
        return d >= weekStart && d <= weekEnd && r.amount_received > 0;
      })
      .reduce((s, r) => s + (r.amount_received || 0), 0);
  }, [receivables, weekStart, weekEnd]);

  const openCount = promises.filter(p => {
    const days = daysDiff(p.promise_date);
    return days !== null && days >= 0 && p.promise_status !== 'broken';
  }).length;

  const brokenCount = promises.filter(p => {
    const days = daysDiff(p.promise_date);
    return p.promise_status === 'broken' || (days !== null && days < 0);
  }).length;

  if (promises.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Banknote className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No promises recorded yet</p>
        <p className="text-xs mt-1">Log a follow-up with outcome "Promised Payment" to track it here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-blue-100 bg-blue-50/50">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-blue-700">{openCount}</div>
            <div className="text-xs text-blue-600 mt-0.5 font-medium">Open Promises</div>
          </CardContent>
        </Card>
        <Card className="border-red-100 bg-red-50/50">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-red-600">{brokenCount}</div>
            <div className="text-xs text-red-500 mt-0.5 font-medium">Broken</div>
          </CardContent>
        </Card>
        <Card className="border-amber-100 bg-amber-50/50">
          <CardContent className="p-3 text-center">
            <div className="text-sm font-bold text-amber-700">{formatINR(weekPromisedTotal)}</div>
            <div className="text-xs text-amber-600 mt-0.5 font-medium">Promised This Week</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-100 bg-emerald-50/50">
          <CardContent className="p-3 text-center">
            <div className="text-sm font-bold text-emerald-700">{formatINR(weekReceived)}</div>
            <div className="text-xs text-emerald-600 mt-0.5 font-medium">Received This Week</div>
          </CardContent>
        </Card>
      </div>

      {/* Promise List */}
      <div className="space-y-2">
        {promises.map(p => {
          const days = daysDiff(p.promise_date);
          const isBroken = p.promise_status === 'broken' || (days !== null && days < 0);
          const rowBg = isBroken
            ? 'border-l-4 border-l-red-400 bg-red-50/20'
            : days === 0
            ? 'border-l-4 border-l-orange-400 bg-orange-50/20'
            : days !== null && days <= 3
            ? 'border-l-4 border-l-amber-400 bg-amber-50/20'
            : 'border-l-4 border-l-border';

          return (
            <Card key={p.id} className={rowBg}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">{p.debtor_name}</span>
                      <StatusBadge promise={p} receivables={receivables} />
                    </div>
                    {p.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">"{p.notes}"</p>
                    )}
                  </div>
                  <div className="flex items-center gap-6 shrink-0 flex-wrap">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Promised Amount</div>
                      <div className="text-sm font-bold text-foreground">{formatINR(p.promise_amount)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Promise Date</div>
                      <div className="text-sm font-semibold">{formatDateIN(p.promise_date)}</div>
                      {days !== null && (
                        <div className={`text-xs font-medium mt-0.5 ${
                          isBroken ? 'text-red-600' :
                          days === 0 ? 'text-orange-600' :
                          days <= 3 ? 'text-amber-600' :
                          'text-muted-foreground'
                        }`}>
                          {isBroken ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d remaining`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}