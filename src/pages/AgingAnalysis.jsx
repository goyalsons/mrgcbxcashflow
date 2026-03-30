import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR, formatDateIN } from '@/lib/utils/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, AlertTriangle, TrendingDown, Clock, ShieldAlert } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';
import { getCreditStatus } from '@/components/shared/CreditStatusBadge';

const BUCKETS = [
  { label: '0–30 days', key: 'b0', min: 0, max: 30, color: 'bg-emerald-500' },
  { label: '31–60 days', key: 'b1', min: 31, max: 60, color: 'bg-amber-400' },
  { label: '61–90 days', key: 'b2', min: 61, max: 90, color: 'bg-orange-500' },
  { label: '90+ days', key: 'b3', min: 91, max: Infinity, color: 'bg-red-600' },
];

function getDaysOverdue(dueDate) {
  if (!dueDate) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((today - due) / 86400000));
}

function getBucket(days) {
  return BUCKETS.find(b => days >= b.min && days <= b.max) || BUCKETS[3];
}

function AgingTable({ items, type, onStatusChange }) {
  const bucketed = useMemo(() => {
    const result = { b0: [], b1: [], b2: [], b3: [] };
    items.forEach(item => {
      const days = getDaysOverdue(item.due_date);
      const b = getBucket(days);
      result[b.key].push({ ...item, daysOverdue: days });
    });
    return result;
  }, [items]);

  const totalByBucket = BUCKETS.map(b => ({
    ...b,
    total: bucketed[b.key].reduce((s, i) => {
      const bal = type === 'receivable'
        ? (i.amount || 0) - (i.amount_received || 0)
        : (i.amount || 0) - (i.amount_paid || 0);
      return s + bal;
    }, 0),
    count: bucketed[b.key].length,
  }));

  const grandTotal = totalByBucket.reduce((s, b) => s + b.total, 0);

  // DSO = (Total Receivables Outstanding / Total Revenue) * Days
  const dso = type === 'receivable' && grandTotal > 0
    ? Math.round((grandTotal / Math.max(grandTotal, 1)) * 45) // simplified DSO
    : null;

  const [filter, setFilter] = useState('all');
  const displayItems = useMemo(() => {
    const all = [...bucketed.b0, ...bucketed.b1, ...bucketed.b2, ...bucketed.b3];
    if (filter === 'all') return all;
    return bucketed[filter] || all;
  }, [bucketed, filter]);

  return (
    <div className="space-y-4">
      {/* Bucket Summary with DSO Badge */}
      <div className="relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {totalByBucket.map(b => (
            <Card key={b.key} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter(filter === b.key ? 'all' : b.key)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${b.color}`} />
                  <span className="text-xs font-medium text-muted-foreground">{b.label}</span>
                </div>
                <div className="text-lg font-bold">{formatINR(b.total)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{b.count} item{b.count !== 1 ? 's' : ''}</div>
              </CardContent>
            </Card>
          ))}
        </div>
        {type === 'receivable' && (
          <div className="absolute -top-10 right-0 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-right">
            <div className="text-xs text-blue-600 font-medium">Days Avg Overdue</div>
            <div className="text-lg font-bold text-blue-700">
              {grandTotal > 0 ? `~${Math.round(items.filter(i => i.status !== 'paid').length > 0 ? (items.filter(i=>i.status!=='paid').reduce((s,i)=>s+getDaysOverdue(i.due_date),0)/Math.max(items.filter(i=>i.status!=='paid').length,1)) : 0)} days` : 'N/A'}
            </div>
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 pt-4">
        <span className="text-sm text-muted-foreground">Filter:</span>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Buckets</SelectItem>
            {BUCKETS.map(b => <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm font-semibold">Total: {formatINR(grandTotal)}</div>
      </div>

      {/* Table */}
      {displayItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">No items found</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{type === 'receivable' ? 'Customer' : 'Vendor'}</TableHead>
              <TableHead>Invoice/Bill #</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Days Overdue</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayItems.map(item => {
              const bal = type === 'receivable'
                ? (item.amount || 0) - (item.amount_received || 0)
                : (item.amount || 0) - (item.amount_paid || 0);
              const bucket = getBucket(item.daysOverdue);
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{type === 'receivable' ? item.customer_name : item.vendor_name}</TableCell>
                  <TableCell>{type === 'receivable' ? item.invoice_number : item.bill_number || '-'}</TableCell>
                  <TableCell>{formatDateIN(item.due_date)}</TableCell>
                  <TableCell>
                    {item.daysOverdue > 0 ? (
                      <Badge variant="outline" className={`text-xs ${
                        item.daysOverdue > 90 ? 'bg-red-50 text-red-700 border-red-200' :
                        item.daysOverdue > 60 ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        item.daysOverdue > 30 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {item.daysOverdue}d overdue
                      </Badge>
                    ) : <span className="text-emerald-600 text-xs">Current</span>}
                  </TableCell>
                  <TableCell className="text-right">{formatINR(item.amount)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatINR(bal)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${
                      item.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      item.status === 'disputed' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      item.status === 'written_off' ? 'bg-gray-50 text-gray-500 border-gray-200' :
                      item.status === 'overdue' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>{item.status?.replace('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onStatusChange(item.id, 'disputed', type)}>
                          <AlertTriangle className="w-4 h-4 mr-2 text-purple-600" />Mark Disputed
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onStatusChange(item.id, 'written_off', type)}>
                          <TrendingDown className="w-4 h-4 mr-2 text-gray-500" />Write Off
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onStatusChange(item.id, 'overdue', type)}>
                          Mark Overdue
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function CreditUtilisation({ debtors }) {
  const debtorsWithLimit = debtors.filter(d => d.credit_limit > 0);
  if (!debtorsWithLimit.length) return (
    <div className="text-center py-12 text-muted-foreground text-sm">
      <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p>No credit limits set yet.</p>
      <p className="text-xs mt-1">Set a Credit Limit on a debtor profile to track utilisation here.</p>
    </div>
  );

  const overLimit = debtorsWithLimit.filter(d => (d.total_outstanding || 0) > d.credit_limit);
  const nearLimit = debtorsWithLimit.filter(d => {
    const pct = ((d.total_outstanding || 0) / d.credit_limit) * 100;
    return pct >= 70 && pct <= 100;
  });

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-red-50 border-red-100">
          <CardContent className="p-4 text-center">
            <div className="text-xs text-red-600 font-medium mb-0.5">Over Limit</div>
            <div className="text-2xl font-bold text-red-700">{overLimit.length}</div>
            <div className="text-xs text-red-500">debtors</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <CardContent className="p-4 text-center">
            <div className="text-xs text-amber-600 font-medium mb-0.5">Near Limit (70–100%)</div>
            <div className="text-2xl font-bold text-amber-700">{nearLimit.length}</div>
            <div className="text-xs text-amber-500">debtors</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-4 text-center">
            <div className="text-xs text-emerald-600 font-medium mb-0.5">Within Limit</div>
            <div className="text-2xl font-bold text-emerald-700">{debtorsWithLimit.length - overLimit.length - nearLimit.length}</div>
            <div className="text-xs text-emerald-500">debtors</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Debtor</TableHead>
            <TableHead className="text-right">Credit Limit</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead className="text-right">Available</TableHead>
            <TableHead>Utilisation</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {debtorsWithLimit
            .sort((a, b) => {
              const pctA = (a.total_outstanding || 0) / a.credit_limit;
              const pctB = (b.total_outstanding || 0) / b.credit_limit;
              return pctB - pctA;
            })
            .map(d => {
              const outstanding = d.total_outstanding || 0;
              const limit = d.credit_limit;
              const pct = Math.min((outstanding / limit) * 100, 100);
              const available = Math.max(limit - outstanding, 0);
              const status = getCreditStatus(outstanding, limit);
              const barColor = status?.variant === 'over' ? 'bg-red-500' : status?.variant === 'warning' ? 'bg-amber-500' : 'bg-emerald-500';
              return (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="font-medium">{d.name}</div>
                    {d.contact_person && <div className="text-xs text-muted-foreground">{d.contact_person}</div>}
                  </TableCell>
                  <TableCell className="text-right">{formatINR(limit)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatINR(outstanding)}</TableCell>
                  <TableCell className={`text-right font-semibold ${available === 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {available === 0 ? '— Exceeded' : formatINR(available)}
                  </TableCell>
                  <TableCell className="w-40">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full">
                        <div
                          className={`h-2 rounded-full transition-all ${barColor}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right">{((outstanding / limit) * 100).toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {status && (
                      <Badge variant="outline" className={`text-xs ${status.color}`}>{status.label}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </div>
  );
}

export default function AgingAnalysis() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: receivables = [] } = useQuery({
    queryKey: ['receivables'],
    queryFn: () => base44.entities.Receivable.list(),
  });
  const { data: payables = [] } = useQuery({
    queryKey: ['payables'],
    queryFn: () => base44.entities.Payable.list(),
  });
  const { data: debtors = [] } = useQuery({
    queryKey: ['debtors'],
    queryFn: () => base44.entities.Debtor.list(),
  });

  const unpaidReceivables = receivables.filter(r => r.status !== 'paid' && r.status !== 'written_off');
  const unpaidPayables = payables.filter(p => p.status !== 'paid');

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status, type }) => type === 'receivable'
      ? base44.entities.Receivable.update(id, { status })
      : base44.entities.Payable.update(id, { status }),
    onSuccess: (_, { type }) => {
      queryClient.invalidateQueries({ queryKey: [type === 'receivable' ? 'receivables' : 'payables'] });
      toast({ title: 'Status updated' });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Aging Analysis" subtitle="Track overdue receivables and payables by aging buckets" />
      <Tabs defaultValue="receivables">
        <TabsList>
          <TabsTrigger value="receivables">Receivables ({unpaidReceivables.length})</TabsTrigger>
          <TabsTrigger value="payables">Payables ({unpaidPayables.length})</TabsTrigger>
          <TabsTrigger value="credit" className="gap-1"><ShieldAlert className="w-3.5 h-3.5" />Credit Limits</TabsTrigger>
        </TabsList>
        <TabsContent value="receivables" className="mt-4">
          <AgingTable items={unpaidReceivables} type="receivable" onStatusChange={(id, status, type) => updateStatusMut.mutate({ id, status, type })} />
        </TabsContent>
        <TabsContent value="payables" className="mt-4">
          <AgingTable items={unpaidPayables} type="payable" onStatusChange={(id, status, type) => updateStatusMut.mutate({ id, status, type })} />
        </TabsContent>
        <TabsContent value="credit" className="mt-4">
          <CreditUtilisation debtors={debtors} />
        </TabsContent>
      </Tabs>
    </div>
  );
}