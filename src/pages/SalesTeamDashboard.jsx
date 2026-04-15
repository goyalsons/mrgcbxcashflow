import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR } from '@/lib/utils/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDownLeft, Target, Users, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700' },
  partially_paid: { label: 'Partial', color: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Paid', color: 'bg-emerald-100 text-emerald-700' },
  written_off: { label: 'Written Off', color: 'bg-gray-100 text-gray-600' },
};

function StatCard({ title, value, subtitle, icon: Icon, variant = 'default' }) {
  const colors = {
    default: 'text-foreground',
    success: 'text-emerald-600',
    danger: 'text-red-600',
    warning: 'text-amber-600',
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className={`text-xl font-bold mt-1 ${colors[variant]}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-muted/50`}>
            <Icon className={`w-4 h-4 ${colors[variant]}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SalesTeamDashboard() {
  const { user } = useAuth();

  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: receivables = [], isLoading: loadingRec } = useQuery({
    queryKey: ['receivables'],
    queryFn: () => base44.entities.Receivable.list(),
  });

  const { data: targets = [], isLoading: loadingTargets } = useQuery({
    queryKey: ['collectionTargets'],
    queryFn: () => base44.entities.CollectionTarget.list('-created_date'),
  });

  const isLoading = loadingCustomers || loadingRec || loadingTargets;

  // My assigned customers
  const myCustomers = useMemo(() =>
    customers.filter(c => c.account_manager === user?.email),
    [customers, user]
  );

  const myCustomerNames = useMemo(() =>
    new Set(myCustomers.map(c => c.name?.trim().toLowerCase())),
    [myCustomers]
  );

  // My receivables (by customer name match)
  const myReceivables = useMemo(() =>
    receivables.filter(r =>
      r.customer_name && myCustomerNames.has(r.customer_name.trim().toLowerCase())
    ),
    [receivables, myCustomerNames]
  );

  // My active targets (this month)
  const now = new Date();
  const myTargets = useMemo(() =>
    targets.filter(t =>
      t.manager_email === user?.email &&
      t.period_month === now.getMonth() + 1 &&
      t.period_year === now.getFullYear()
    ),
    [targets, user]
  );

  // Summary stats
  const totalOutstanding = myReceivables
    .filter(r => !['paid', 'written_off'].includes(r.status))
    .reduce((s, r) => s + Math.max(0, (r.amount || 0) - (r.amount_received || 0)), 0);

  const overdueCount = myReceivables.filter(r => r.status === 'overdue').length;
  const totalCollected = myReceivables.reduce((s, r) => s + (r.amount_received || 0), 0);

  const totalTarget = myTargets.reduce((s, t) => s + (t.target_amount || 0), 0);
  const totalTargetCollected = myTargets.reduce((s, t) => s + (t.collected_amount || 0), 0);
  const targetPct = totalTarget > 0 ? Math.min(100, Math.round((totalTargetCollected / totalTarget) * 100)) : 0;

  // Chart data — outstanding by customer
  const chartData = useMemo(() => {
    const map = {};
    myReceivables
      .filter(r => !['paid', 'written_off'].includes(r.status))
      .forEach(r => {
        const name = r.customer_name?.trim() || 'Unknown';
        const outstanding = Math.max(0, (r.amount || 0) - (r.amount_received || 0));
        map[name] = (map[name] || 0) + outstanding;
      });
    return Object.entries(map)
      .map(([name, amount]) => ({ name: name.length > 14 ? name.slice(0, 14) + '…' : name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [myReceivables]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-5 border-b border-border">
        <h1 className="text-xl font-bold tracking-tight">My Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Welcome back, {user?.full_name || user?.email} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="My Clients" value={myCustomers.length} icon={Users} />
        <StatCard title="Outstanding" value={formatINR(totalOutstanding)} icon={ArrowDownLeft} variant="danger" />
        <StatCard title="Overdue Invoices" value={overdueCount} icon={AlertTriangle} variant={overdueCount > 0 ? 'danger' : 'success'} />
        <StatCard title="Total Collected" value={formatINR(totalCollected)} icon={CheckCircle2} variant="success" />
      </div>

      {/* Monthly Target Progress */}
      {myTargets.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              This Month's Target
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {myTargets.map(t => {
              const pct = t.target_amount > 0 ? Math.min(100, Math.round(((t.collected_amount || 0) / t.target_amount) * 100)) : 0;
              return (
                <div key={t.id}>
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <span className="font-medium">{t.customer_name || 'General Target'}</span>
                    <span className="font-bold text-primary">{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span className="text-emerald-600 font-medium">{formatINR(t.collected_amount || 0)} collected</span>
                    <span>Target: {formatINR(t.target_amount)}</span>
                  </div>
                </div>
              );
            })}
            <div className="border-t pt-2 flex justify-between text-xs font-semibold">
              <span>Overall: {formatINR(totalTargetCollected)} / {formatINR(totalTarget)}</span>
              <span className="text-primary">{targetPct}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chart + Overdue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Outstanding by customer chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Outstanding by Client</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">No outstanding receivables</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatINR(v)} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={`hsl(var(--chart-${(i % 5) + 1}))`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Overdue invoices */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-red-500" />
              Overdue Invoices
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {myReceivables.filter(r => r.status === 'overdue').length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">No overdue invoices 🎉</div>
            ) : (
              <div className="max-h-52 overflow-y-auto space-y-2">
                {myReceivables
                  .filter(r => r.status === 'overdue')
                  .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
                  .slice(0, 10)
                  .map(r => (
                    <div key={r.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{r.customer_name}</p>
                        <p className="text-xs text-muted-foreground">Due: {r.due_date ? new Date(r.due_date).toLocaleDateString('en-IN') : '—'} · {r.invoice_number || 'No#'}</p>
                      </div>
                      <span className="text-sm font-semibold text-red-600">{formatINR(Math.max(0, (r.amount || 0) - (r.amount_received || 0)))}</span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* My Receivables Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">My Receivables</CardTitle>
            <Link to="/receivables" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {myReceivables.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No receivables for your assigned clients.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myReceivables
                    .filter(r => !['paid', 'written_off'].includes(r.status))
                    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
                    .slice(0, 15)
                    .map(r => {
                      const outstanding = Math.max(0, (r.amount || 0) - (r.amount_received || 0));
                      const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium text-sm">{r.customer_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.invoice_number || '—'}</TableCell>
                          <TableCell className="text-right text-sm">{formatINR(r.amount)}</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-red-600">{formatINR(outstanding)}</TableCell>
                          <TableCell className="text-sm">{r.due_date ? new Date(r.due_date).toLocaleDateString('en-IN') : '—'}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}