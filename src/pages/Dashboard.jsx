import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR } from '@/lib/utils/currency';
import { Landmark, ArrowDownLeft, ArrowUpRight, Receipt, Wallet, Users } from 'lucide-react';
import StatCard from '@/components/shared/StatCard';
import CashFlowChart from '@/components/dashboard/CashFlowChart';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import OverdueAlerts from '@/components/dashboard/OverdueAlerts';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';

export default function Dashboard() {
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

  const isLoading = loadingBanks || loadingRec || loadingPay || loadingExp || loadingDebtors;

  const totalBankBalance = bankAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalReceivable = receivables
    .filter(r => r.status !== 'paid' && r.status !== 'written_off')
    .reduce((sum, r) => sum + ((r.amount || 0) - (r.amount_received || 0)), 0);
  const totalPayable = payables
    .filter(p => p.status !== 'paid')
    .reduce((sum, p) => sum + ((p.amount || 0) - (p.amount_paid || 0)), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netCashPosition = totalBankBalance + totalReceivable - totalPayable;

  // Debtor stats
  const totalDebtorOutstanding = debtors.reduce((sum, d) => sum + (d.total_outstanding || 0), 0);
  const activeDebtors = debtors.filter(d => (d.total_outstanding || 0) > 0).length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Your cash flow at a glance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Bank Balance" value={formatINR(totalBankBalance)} icon={Landmark} variant="info" />
        <Link to="/debtors" className="contents">
          <StatCard title="Debtor Outstanding" value={formatINR(totalDebtorOutstanding)} icon={Users} variant="danger" subtitle={`${activeDebtors} active debtors`} />
        </Link>
        <StatCard title="Receivables" value={formatINR(totalReceivable)} icon={ArrowDownLeft} variant="success" />
        <StatCard title="Payables" value={formatINR(totalPayable)} icon={ArrowUpRight} variant="danger" />
        <StatCard title="Expenses" value={formatINR(totalExpenses)} icon={Receipt} variant="warning" />
        <StatCard title="Net Position" value={formatINR(netCashPosition)} icon={Wallet} variant={netCashPosition >= 0 ? 'success' : 'danger'} />
      </div>

      {/* Charts + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CashFlowChart receivables={receivables} payables={payables} expenses={expenses} />
        </div>
        <div>
          <OverdueAlerts receivables={receivables} payables={payables} />
        </div>
      </div>

      {/* Recent Transactions */}
      <RecentTransactions receivables={receivables} payables={payables} expenses={expenses} />
    </div>
  );
}