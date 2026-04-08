import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR, formatDateIN } from '@/lib/utils/currency';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, AlertTriangle, TrendingDown, ShieldAlert, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
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

function SortIcon({ field, sortKey, sortDir }) {
  if (sortKey !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40 inline" />;
  return sortDir === 'asc'
    ? <ArrowUp className="w-3 h-3 ml-1 inline text-primary" />
    : <ArrowDown className="w-3 h-3 ml-1 inline text-primary" />;
}

function SortableHead({ field, label, sortKey, sortDir, onSort, className }) {
  return (
    <TableHead
      className={`cursor-pointer select-none hover:bg-muted/60 sticky top-0 bg-card z-20 whitespace-nowrap ${className || ''}`}
      onClick={() => onSort(field)}
    >
      {label}<SortIcon field={field} sortKey={sortKey} sortDir={sortDir} />
    </TableHead>
  );
}

function AgingTable({ items, type, onStatusChange }) {
  const [search, setSearch] = useState('');
  const [bucketFilter, setBucketFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState('daysOverdue');
  const [sortDir, setSortDir] = useState('desc');

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

  const handleSort = (field) => {
    if (sortKey === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(field); setSortDir('asc'); }
  };

  const displayItems = useMemo(() => {
    let all = bucketFilter === 'all'
      ? [...bucketed.b0, ...bucketed.b1, ...bucketed.b2, ...bucketed.b3]
      : bucketed[bucketFilter] || [];

    if (statusFilter !== 'all') all = all.filter(i => i.status === statusFilter);

    const q = search.toLowerCase();
    if (q) {
      all = all.filter(i => {
        const name = type === 'receivable' ? i.customer_name : i.vendor_name;
        const num = type === 'receivable' ? i.invoice_number : i.bill_number;
        return (name || '').toLowerCase().includes(q) || (num || '').toLowerCase().includes(q);
      });
    }

    all.sort((a, b) => {
      let av, bv;
      if (sortKey === 'name') {
        av = type === 'receivable' ? (a.customer_name || '') : (a.vendor_name || '');
        bv = type === 'receivable' ? (b.customer_name || '') : (b.vendor_name || '');
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      } else if (sortKey === 'amount') {
        av = a.amount || 0; bv = b.amount || 0;
      } else if (sortKey === 'balance') {
        av = type === 'receivable' ? (a.amount || 0) - (a.amount_received || 0) : (a.amount || 0) - (a.amount_paid || 0);
        bv = type === 'receivable' ? (b.amount || 0) - (b.amount_received || 0) : (b.amount || 0) - (b.amount_paid || 0);
      } else if (sortKey === 'due_date') {
        av = new Date(a.due_date || 0).getTime(); bv = new Date(b.due_date || 0).getTime();
      } else {
        av = a.daysOverdue; bv = b.daysOverdue;
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    return all;
  }, [bucketed, bucketFilter, statusFilter, search, sortKey, sortDir, type]);

  const STATUSES = type === 'receivable'
    ? ['pending', 'partially_paid', 'overdue', 'written_off', 'disputed']
    : ['pending', 'partially_paid', 'overdue'];

  return (
    <div className="space-y-4">
      {/* Bucket Summary */}
      <div className="relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {totalByBucket.map(b => (
            <Card key={b.key} className={`cursor-pointer hover:shadow-md transition-shadow ${bucketFilter === b.key ? 'ring-2 ring-primary' : ''}`} onClick={() => setBucketFilter(bucketFilter === b.key ? 'all' : b.key)}>
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
              {grandTotal > 0 ? `~${Math.round(items.filter(i => i.status !== 'paid').length > 0 ? (items.filter(i => i.status !== 'paid').reduce((s, i) => s + getDaysOverdue(i.due_date), 0) / Math.max(items.filter(i => i.status !== 'paid').length, 1)) : 0)} days` : 'N/A'}
            </div>
          </div>
        )}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-2 pt-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder={`Search by ${type === 'receivable' ? 'customer' : 'vendor'} or invoice #...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={bucketFilter} onValueChange={setBucketFilter}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Bucket" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Buckets</SelectItem>
            {BUCKETS.map(b => <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm font-semibold whitespace-nowrap">Total: {formatINR(grandTotal)}</div>
      </div>

      {/* Table */}
      {displayItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">No items found</div>
      ) : (
        <div className="overflow-auto max-h-[520px] rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead field="name" label={type === 'receivable' ? 'Customer' : 'Vendor'} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="left-0 z-30 bg-card" />
                <TableHead className="sticky top-0 bg-card z-20 whitespace-nowrap">Invoice/Bill #</TableHead>
                <SortableHead field="due_date" label="Due Date" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHead field="daysOverdue" label="Days Overdue" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHead field="amount" label="Amount" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right" />
                <SortableHead field="balance" label="Balance" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right" />
                <TableHead className="sticky top-0 bg-card z-20">Status</TableHead>
                <TableHead className="sticky top-0 bg-card z-20 w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayItems.map((item, idx) => {
                const bal = type === 'receivable'
                  ? (item.amount || 0) - (item.amount_received || 0)
                  : (item.amount || 0) - (item.amount_paid || 0);
                const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-muted/30';
                return (
                  <TableRow key={item.id} className={rowBg}>
                    <TableCell className={`font-medium sticky left-0 z-10 ${rowBg}`}>{type === 'receivable' ? item.customer_name : item.vendor_name}</TableCell>
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
        </div>
      )}
    </div>
  );
}

function CreditUtilisation({ debtors }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('pct');
  const [sortDir, setSortDir] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('all');

  const debtorsWithLimit = debtors.filter(d => d.credit_limit > 0);

  const overLimit = debtorsWithLimit.filter(d => (d.total_outstanding || 0) > d.credit_limit);
  const nearLimit = debtorsWithLimit.filter(d => {
    const pct = ((d.total_outstanding || 0) / d.credit_limit) * 100;
    return pct >= 70 && pct <= 100;
  });

  const handleSort = (field) => {
    if (sortKey === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(field); setSortDir('asc'); }
  };

  const displayDebtors = useMemo(() => {
    let list = debtorsWithLimit.map(d => ({
      ...d,
      pct: ((d.total_outstanding || 0) / d.credit_limit) * 100,
    }));

    const q = search.toLowerCase();
    if (q) list = list.filter(d => (d.name || '').toLowerCase().includes(q));

    if (statusFilter === 'over') list = list.filter(d => d.pct > 100);
    else if (statusFilter === 'near') list = list.filter(d => d.pct >= 70 && d.pct <= 100);
    else if (statusFilter === 'ok') list = list.filter(d => d.pct < 70);

    list.sort((a, b) => {
      let av, bv;
      if (sortKey === 'name') { return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name); }
      else if (sortKey === 'limit') { av = a.credit_limit; bv = b.credit_limit; }
      else if (sortKey === 'outstanding') { av = a.total_outstanding || 0; bv = b.total_outstanding || 0; }
      else { av = a.pct; bv = b.pct; }
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    return list;
  }, [debtorsWithLimit, search, statusFilter, sortKey, sortDir]);

  if (!debtorsWithLimit.length) return (
    <div className="text-center py-12 text-muted-foreground text-sm">
      <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p>No credit limits set yet.</p>
      <p className="text-xs mt-1">Set a Credit Limit on a debtor profile to track utilisation here.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-red-50 border-red-100"><CardContent className="p-4 text-center">
          <div className="text-xs text-red-600 font-medium mb-0.5">Over Limit</div>
          <div className="text-2xl font-bold text-red-700">{overLimit.length}</div>
          <div className="text-xs text-red-500">debtors</div>
        </CardContent></Card>
        <Card className="bg-amber-50 border-amber-100"><CardContent className="p-4 text-center">
          <div className="text-xs text-amber-600 font-medium mb-0.5">Near Limit (70–100%)</div>
          <div className="text-2xl font-bold text-amber-700">{nearLimit.length}</div>
          <div className="text-xs text-amber-500">debtors</div>
        </CardContent></Card>
        <Card className="bg-emerald-50 border-emerald-100"><CardContent className="p-4 text-center">
          <div className="text-xs text-emerald-600 font-medium mb-0.5">Within Limit</div>
          <div className="text-2xl font-bold text-emerald-700">{debtorsWithLimit.length - overLimit.length - nearLimit.length}</div>
          <div className="text-xs text-emerald-500">debtors</div>
        </CardContent></Card>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search debtor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="over">Over Limit</SelectItem>
            <SelectItem value="near">Near Limit</SelectItem>
            <SelectItem value="ok">Within Limit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-auto max-h-[520px] rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky top-0 left-0 z-30 bg-card cursor-pointer hover:bg-muted/60" onClick={() => handleSort('name')}>
                Debtor <SortIcon field="name" sortKey={sortKey} sortDir={sortDir} />
              </TableHead>
              <TableHead className="sticky top-0 z-20 bg-card text-right cursor-pointer hover:bg-muted/60" onClick={() => handleSort('limit')}>
                Credit Limit <SortIcon field="limit" sortKey={sortKey} sortDir={sortDir} />
              </TableHead>
              <TableHead className="sticky top-0 z-20 bg-card text-right cursor-pointer hover:bg-muted/60" onClick={() => handleSort('outstanding')}>
                Outstanding <SortIcon field="outstanding" sortKey={sortKey} sortDir={sortDir} />
              </TableHead>
              <TableHead className="sticky top-0 z-20 bg-card text-right">Available</TableHead>
              <TableHead className="sticky top-0 z-20 bg-card cursor-pointer hover:bg-muted/60" onClick={() => handleSort('pct')}>
                Utilisation <SortIcon field="pct" sortKey={sortKey} sortDir={sortDir} />
              </TableHead>
              <TableHead className="sticky top-0 z-20 bg-card">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayDebtors.map((d, idx) => {
              const outstanding = d.total_outstanding || 0;
              const limit = d.credit_limit;
              const pct = Math.min(d.pct, 100);
              const available = Math.max(limit - outstanding, 0);
              const status = getCreditStatus(outstanding, limit);
              const barColor = status?.variant === 'over' ? 'bg-red-500' : status?.variant === 'warning' ? 'bg-amber-500' : 'bg-emerald-500';
              const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-muted/30';
              return (
                <TableRow key={d.id} className={rowBg}>
                  <TableCell className={`sticky left-0 z-10 ${rowBg}`}>
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
                        <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right">{d.pct.toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {status && <Badge variant="outline" className={`text-xs ${status.color}`}>{status.label}</Badge>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function AgingAnalysis() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: receivables = [] } = useQuery({ queryKey: ['receivables'], queryFn: () => base44.entities.Receivable.list() });
  const { data: payables = [] } = useQuery({ queryKey: ['payables'], queryFn: () => base44.entities.Payable.list() });
  const { data: debtors = [] } = useQuery({ queryKey: ['debtors'], queryFn: () => base44.entities.Debtor.list() });

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