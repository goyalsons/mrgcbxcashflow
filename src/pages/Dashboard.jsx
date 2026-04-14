import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR } from '@/lib/utils/currency';
import { Landmark, ArrowDownLeft, ArrowUpRight, Receipt, Wallet, Users } from 'lucide-react';
import StatCard from '@/components/shared/StatCard';
import CollectionTrendsChart from '@/components/dashboard/CollectionTrendsChart';
import OutstandingReceivablesChart from '@/components/dashboard/OutstandingReceivablesChart';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import ProjectedCashFlow4Weeks from '@/components/dashboard/ProjectedCashFlow4Weeks';
import ProjectedCashFlow3Months from '@/components/dashboard/ProjectedCashFlow3Months';
import TopOverduePayments from '@/components/dashboard/TopOverduePayments';
import TopCollectionTargets from '@/components/dashboard/TopCollectionTargets';
import DateRangePicker, { getPresetRange } from '@/components/dashboard/DateRangePicker';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { isWithinInterval } from 'date-fns';

const defaultRange = { preset: 'this_month', ...getPresetRange('this_month') };

function inRange(dateStr, from, to) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return isWithinInterval(d, { start: from, end: to });
}

export default function Dashboard() {
  const [dateRange, setDateRange] = useState(defaultRange);

  const { data: bankAccounts = [], isLoading: loadingBanks } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: () => base44.entities.BankAccount.list(),
  });
  const { data: receivables = [], isLoading: loadingRec } = useQuery({
    queryKey: ['receivables'],
    queryFn: () => base44.entities.Receivable.list(),
  });
  const { data: payables = [], isLoading: loadingPay } = useQuery({
    queryKey: ['payables'],
    queryFn: () => base44.entities.Payable.list(),
  });
  const { data: expenses = [], isLoading: loadingExp } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list(),
  });
  const { data: debtors = [], isLoading: loadingDebtors } = useQuery({
    queryKey: ['debtors'],
    queryFn: () => base44.entities.Debtor.list(),
  });
  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list(),
  });

  const isLoading = loadingBanks || loadingRec || loadingPay || loadingExp || loadingDebtors || loadingPayments;

  // Filter all transactional data to the selected date range
  const { from, to } = dateRange;

  const filteredReceivables = useMemo(() =>
    from && to ? receivables.filter(r => inRange(r.invoice_date || r.due_date, from, to)) : receivables,
    [receivables, from, to]
  );
  const filteredPayables = useMemo(() =>
    from && to ? payables.filter(p => inRange(p.bill_date || p.due_date, from, to)) : payables,
    [payables, from, to]
  );
  const filteredExpenses = useMemo(() =>
    from && to ? expenses.filter(e => inRange(e.expense_date, from, to)) : expenses,
    [expenses, from, to]
  );
  const filteredPayments = useMemo(() =>
    from && to ? payments.filter(p => inRange(p.payment_date, from, to)) : payments,
    [payments, from, to]
  );

  // Stat calculations on filtered data
  const totalBankBalance = bankAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  const totalOutstandingReceivable = receivables
    .filter(r => !['paid', 'written_off'].includes(r.status))
    .reduce((sum, r) => sum + ((r.amount || 0) - (r.amount_received || 0)), 0);

  const activeDebtors = receivables.filter(r => !['paid', 'written_off'].includes(r.status)).length;

  const totalReceivable = filteredReceivables
    .reduce((sum, r) => sum + (r.amount_received || 0), 0);

  const totalPayable = filteredPayables
    .filter(p => p.status !== 'paid')
    .reduce((sum, p) => sum + ((p.amount || 0) - (p.amount_paid || 0)), 0);

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netCashPosition = totalBankBalance + totalOutstandingReceivable - totalPayable;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 mb-2" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard title="Bank Balance" value={formatINR(totalBankBalance)} icon={Landmark} variant="info" />
        <Link to="/receivables" className="contents">
          <StatCard title="Receivable" value={formatINR(totalOutstandingReceivable)} icon={Users} variant="danger" subtitle={`${activeDebtors} active`} />
        </Link>
        <StatCard title="Received Amount" value={formatINR(totalReceivable)} icon={ArrowDownLeft} variant="success" />
        <StatCard title="Payables" value={formatINR(totalPayable)} icon={ArrowUpRight} variant="danger" />
        <StatCard title="Expenses" value={formatINR(totalExpenses)} icon={Receipt} variant="warning" />
        <StatCard title="Net Position" value={formatINR(netCashPosition)} icon={Wallet} variant={netCashPosition >= 0 ? 'success' : 'danger'} />
      </div>

      {/* Projected Cash Flows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ProjectedCashFlow4Weeks receivables={receivables} payables={payables} expenses={expenses} />
        <ProjectedCashFlow3Months receivables={receivables} payables={payables} expenses={expenses} />
      </div>

      {/* Collection Trends + Outstanding Receivables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CollectionTrendsChart payments={filteredPayments} debtors={debtors} dateRange={dateRange} />
        <OutstandingReceivablesChart receivables={receivables} />
      </div>

      {/* Top Overdue + Top Targets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TopOverduePayments receivables={receivables} />
        <TopCollectionTargets />
      </div>

      {/* Recent Transactions */}
      <RecentTransactions receivables={filteredReceivables} payables={filteredPayables} expenses={filteredExpenses} debtors={debtors} />
    </div>
  );
}