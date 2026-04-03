import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Clock, Percent } from 'lucide-react';
import { formatINR } from '@/lib/utils/currency';

export default function DebtorAnalyticsCards({ debtors, payments = [] }) {
  const stats = useMemo(() => {
    // DSO: average days outstanding
    const today = new Date();
    const dsoValues = debtors
      .filter(d => (d.total_outstanding || 0) > 0)
      .map(d => {
        const created = new Date(d.created_date);
        return Math.max(0, Math.floor((today - created) / (1000 * 60 * 60 * 24)));
      });
    const avgDSO = dsoValues.length ? Math.round(dsoValues.reduce((a, b) => a + b, 0) / dsoValues.length) : 0;

    // Collection rate this month
    const now = new Date();
    const thisMonthPayments = payments.filter(p => {
      const d = new Date(p.payment_date || p.created_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const collectedThisMonth = thisMonthPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const invoicedThisMonth = debtors.reduce((s, d) => s + (d.total_invoiced || 0), 0);
    const collectionRate = invoicedThisMonth > 0 ? Math.round((collectedThisMonth / invoicedThisMonth) * 100) : 0;

    // Overdue trend (compare last 30 days vs prev 30 days)
    const overdueNow = debtors.filter(d => (d.total_outstanding || 0) > 0).reduce((s, d) => s + (d.total_outstanding || 0), 0);
    const prevMonthPayments = payments.filter(p => {
      const d = new Date(p.payment_date || p.created_date);
      const diff = (now - d) / (1000 * 60 * 60 * 24);
      return diff >= 30 && diff < 60;
    }).reduce((s, p) => s + (p.amount || 0), 0);
    const overdueTrend = prevMonthPayments > 0
      ? Math.round(((collectedThisMonth - prevMonthPayments) / prevMonthPayments) * 100)
      : 0;
    const trendUp = overdueTrend >= 0;

    return { avgDSO, collectionRate, overdueTrend, trendUp };
  }, [debtors, payments]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Average DSO</p>
            <p className="text-2xl font-bold text-foreground">{stats.avgDSO} <span className="text-sm font-normal text-muted-foreground">days</span></p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${stats.trendUp ? 'bg-emerald-50' : 'bg-red-50'}`}>
            {stats.trendUp
              ? <TrendingUp className="w-5 h-5 text-emerald-600" />
              : <TrendingDown className="w-5 h-5 text-red-600" />}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Overdue Amount Trend</p>
            <p className={`text-2xl font-bold ${stats.trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
              {stats.trendUp ? '↑' : '↓'} {Math.abs(stats.overdueTrend)}%
            </p>
            <p className="text-xs text-muted-foreground">vs last month</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
            <Percent className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Collection Rate This Month</p>
            <p className="text-2xl font-bold text-foreground">{stats.collectionRate}<span className="text-sm font-normal text-muted-foreground">%</span></p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}