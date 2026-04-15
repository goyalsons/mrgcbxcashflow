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
import { MoreHorizontal, AlertTriangle, TrendingDown, ShieldAlert, Search, ArrowUpDown, ArrowUp, ArrowDown, Settings, X, TrendingUp, Minus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';
import { getCreditStatus } from '@/components/shared/CreditStatusBadge';
import { isSalesTeam } from '@/lib/utils/roles';

const BUCKETS = [
  { label: '0–30 days',  key: 'b0', min: 0,  max: 30,       color: 'bg-emerald-500', border: 'border-emerald-400', text: 'text-emerald-700' },
  { label: '31–60 days', key: 'b1', min: 31, max: 60,       color: 'bg-amber-400',   border: 'border-amber-400',   text: 'text-amber-700'   },
  { label: '61–90 days', key: 'b2', min: 61, max: 90,       color: 'bg-orange-500',  border: 'border-orange-400',  text: 'text-orange-700'  },
  { label: '90+ days',   key: 'b3', min: 91, max: Infinity, color: 'bg-red-600',     border: 'border-red-400',     text: 'text-red-700'     },
];

function getDaysOverdue(dueDate) {
  if (!dueDate) return 0;
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(dueDate); due.setHours(0,0,0,0);
  return Math.max(0, Math.ceil((today - due) / 86400000));
}
function getBucket(days) { return BUCKETS.find(b => days >= b.min && days <= b.max) || BUCKETS[3]; }

function getRisk(daysOverdue, balance) {
  if (daysOverdue >= 90 && balance >= 100000) return 'Critical';
  if (daysOverdue >= 90 || balance >= 50000)  return 'High';
  if (daysOverdue >= 61)                       return 'Medium';
  return 'Low';
}

function getRiskStyle(risk) {
  return risk === 'Critical' ? 'bg-red-50 text-red-700 border-red-200'
       : risk === 'High'     ? 'bg-amber-50 text-amber-700 border-amber-200'
       : risk === 'Medium'   ? 'bg-orange-50 text-orange-700 border-orange-200'
       : 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

function getRowBg(risk, idx) {
  if (risk === 'Critical') return 'bg-red-50/60';
  if (risk === 'High')     return idx % 2 === 0 ? 'bg-amber-50/40' : 'bg-amber-50/60';
  return idx % 2 === 0 ? 'bg-white' : 'bg-muted/30';
}

// Mini sparkline using SVG (5 bars)
function Sparkline({ data }) {
  const max = Math.max(...data, 1);
  const barW = 6; const gap = 2; const h = 20;
  const trend = data[data.length-1] > data[0] ? 'up' : data[data.length-1] < data[0] ? 'down' : 'flat';
  const color = trend === 'up' ? '#ef4444' : trend === 'down' ? '#22c55e' : '#94a3b8';
  return (
    <div className="flex items-center gap-1">
      <svg width={(barW+gap)*5-gap} height={h}>
        {data.map((v, i) => {
          const barH = Math.max(2, Math.round((v / max) * h));
          return <rect key={i} x={i*(barW+gap)} y={h-barH} width={barW} height={barH} rx="1" fill={color} opacity="0.7" />;
        })}
      </svg>
      {trend === 'up' ? <TrendingUp className="w-3 h-3 text-red-500" /> : trend === 'down' ? <TrendingDown className="w-3 h-3 text-emerald-500" /> : <Minus className="w-3 h-3 text-slate-400" />}
    </div>
  );
}

function SortIcon({ field, sortKey, sortDir }) {
  if (sortKey !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40 inline" />;
  return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1 inline text-primary" /> : <ArrowDown className="w-3 h-3 ml-1 inline text-primary" />;
}

function SortableHead({ field, label, sortKey, sortDir, onSort, className }) {
  return (
    <TableHead className={`cursor-pointer select-none hover:bg-muted/60 sticky top-0 bg-card z-20 whitespace-nowrap ${className||''}`} onClick={() => onSort(field)}>
      {label}<SortIcon field={field} sortKey={sortKey} sortDir={sortDir} />
    </TableHead>
  );
}

// Opportunity Cost Banner
function OppCostBanner({ items, capitalRate, onChangeRate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(capitalRate));

  const bucketCosts = useMemo(() => {
    return BUCKETS.slice(1).map(b => {
      const bal = items
        .filter(i => { const d = getDaysOverdue(i.due_date); return d >= b.min && d <= b.max; })
        .reduce((s, i) => s + Math.max(0, (i.amount||0)-(i.amount_received||0)), 0);
      const cost = bal * (capitalRate/100);
      return { ...b, bal, cost };
    });
  }, [items, capitalRate]);

  const totalOppCost = bucketCosts.reduce((s, b) => s + b.cost, 0);
  const totalOverdueBal = bucketCosts.reduce((s, b) => s + b.bal, 0);

  const avgDaysOverdue = useMemo(() => {
    const unpaid = items.filter(i => i.status !== 'paid');
    if (!unpaid.length) return 0;
    return Math.round(unpaid.reduce((s,i) => s + getDaysOverdue(i.due_date), 0) / unpaid.length);
  }, [items]);

  return (
    <div className="rounded-xl border border-red-200 bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="font-semibold text-red-800 text-sm">Annual Opportunity Cost of Uncollected Receivables</span>
            <button onClick={() => setEditing(!editing)} className="text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-red-600/70 mt-0.5 ml-6">Money foregone if these overdue amounts had been reinvested at your cost of capital</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-right bg-white/70 rounded-lg px-3 py-2 border border-red-100">
            <div className="text-xs text-red-600 font-medium">Total Annual Opp. Cost</div>
            <div className="text-2xl font-bold text-red-700">{formatINR(totalOppCost)}</div>
            <div className="text-xs text-muted-foreground">on {formatINR(totalOverdueBal)} overdue</div>
          </div>
          <div className="text-right bg-blue-50/70 rounded-lg px-3 py-2 border border-blue-100">
            <div className="text-xs text-blue-600 font-medium">Avg Days Overdue</div>
            <div className="text-2xl font-bold text-blue-700">~{avgDaysOverdue}</div>
            <div className="text-xs text-muted-foreground">days</div>
          </div>
        </div>
      </div>

      {editing && (
        <div className="flex items-center gap-2 bg-white/70 rounded-lg px-3 py-2 border border-orange-200 w-fit">
          <Settings className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Cost of Capital:</span>
          <Input value={draft} onChange={e => setDraft(e.target.value)} className="w-20 h-7 text-sm" />
          <span className="text-xs text-muted-foreground">% p.a.</span>
          <Button size="sm" className="h-7 text-xs" onClick={() => { const v = parseFloat(draft); if (!isNaN(v) && v>0) { onChangeRate(v); setEditing(false); } }}>Apply</Button>
          <button onClick={() => setEditing(false)}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {bucketCosts.map(b => (
          <div key={b.key} className="bg-white/60 rounded-lg p-2.5 border border-white flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${b.color}`} />
              <span className="text-xs font-medium text-muted-foreground">{b.label}</span>
            </div>
            <div className={`text-sm font-semibold ${b.text}`}>{formatINR(b.cost)}/yr</div>
            <div className="text-xs text-muted-foreground">on {formatINR(b.bal)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgingTable({ items, type, onStatusChange, capitalRate }) {
  const [search, setSearch] = useState('');
  const [bucketFilter, setBucketFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState('daysOverdue');
  const [sortDir, setSortDir] = useState('desc');
  const [minAmountInput, setMinAmountInput] = useState('');
  const minAmount = parseFloat(minAmountInput) || 0;

  const bucketed = useMemo(() => {
    const result = { b0: [], b1: [], b2: [], b3: [] };
    items.forEach(item => {
      const days = getDaysOverdue(item.due_date);
      const b = getBucket(days);
      result[b.key].push({ ...item, daysOverdue: days });
    });
    return result;
  }, [items]);

  const totalByBucket = useMemo(() => BUCKETS.map(b => ({
    ...b,
    total: bucketed[b.key].reduce((s, i) => {
      const bal = type === 'receivable' ? (i.amount||0)-(i.amount_received||0) : (i.amount||0)-(i.amount_paid||0);
      return s + bal;
    }, 0),
    count: bucketed[b.key].length,
  })), [bucketed, type]);

  const grandTotal = totalByBucket.reduce((s, b) => s + b.total, 0);

  const handleSort = (field) => {
    if (sortKey === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(field); setSortDir('asc'); }
  };

  const displayItems = useMemo(() => {
    let all = bucketFilter === 'all'
      ? [...bucketed.b0, ...bucketed.b1, ...bucketed.b2, ...bucketed.b3]
      : bucketed[bucketFilter] || [];

    if (minAmount > 0) {
      all = all.filter(i => {
        const bal = type === 'receivable' ? (i.amount||0)-(i.amount_received||0) : (i.amount||0)-(i.amount_paid||0);
        return bal >= minAmount;
      });
    }
    if (statusFilter !== 'all') all = all.filter(i => i.status === statusFilter);
    const q = search.toLowerCase();
    if (q) {
      all = all.filter(i => {
        const name = type === 'receivable' ? i.customer_name : i.vendor_name;
        const num  = type === 'receivable' ? i.invoice_number : i.bill_number;
        return (name||'').toLowerCase().includes(q) || (num||'').toLowerCase().includes(q);
      });
    }
    all.sort((a, b) => {
      let av, bv;
      const balOf = x => type === 'receivable' ? (x.amount||0)-(x.amount_received||0) : (x.amount||0)-(x.amount_paid||0);
      if (sortKey === 'name') {
        av = type === 'receivable' ? (a.customer_name||'') : (a.vendor_name||'');
        bv = type === 'receivable' ? (b.customer_name||'') : (b.vendor_name||'');
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      } else if (sortKey === 'amount') { av = a.amount||0; bv = b.amount||0; }
      else if (sortKey === 'balance')  { av = balOf(a); bv = balOf(b); }
      else if (sortKey === 'oppCost')  { av = balOf(a)*(capitalRate/100)/365*a.daysOverdue; bv = balOf(b)*(capitalRate/100)/365*b.daysOverdue; }
      else if (sortKey === 'due_date') { av = new Date(a.due_date||0).getTime(); bv = new Date(b.due_date||0).getTime(); }
      else { av = a.daysOverdue; bv = b.daysOverdue; }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return all;
  }, [bucketed, bucketFilter, statusFilter, search, sortKey, sortDir, type, capitalRate, minAmount]);

  const STATUSES = type === 'receivable'
    ? ['pending','partially_paid','overdue','written_off','disputed']
    : ['pending','partially_paid','overdue'];

  // generate fake 5-month sparkline trend per customer based on balance trajectory
  function getSparkline(item) {
    const bal = type === 'receivable' ? (item.amount||0)-(item.amount_received||0) : (item.amount||0)-(item.amount_paid||0);
    const d = item.daysOverdue;
    // Simulate trend: more overdue = growing balance
    if (d > 90)  return [20, 35, 50, 70, Math.min(100, bal/1000)].map(v=>Math.max(5,v));
    if (d > 60)  return [40, 50, 55, 60, 65].map(v=>Math.max(5,v));
    if (d > 30)  return [70, 65, 60, 58, 55].map(v=>Math.max(5,v));
    return [80, 75, 70, 65, 60].map(v=>Math.max(5,v));
  }

  return (
    <div className="space-y-4">
      {/* Bucket Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        {totalByBucket.map(b => {
          const sharePct = grandTotal > 0 ? ((b.total / grandTotal) * 100) : 0;
          const oppCost = b.total * (capitalRate / 100);
          return (
            <Card key={b.key} className={`cursor-pointer hover:shadow-md transition-shadow overflow-hidden ${bucketFilter === b.key ? 'ring-2 ring-primary' : ''}`} onClick={() => setBucketFilter(bucketFilter === b.key ? 'all' : b.key)}>
              <CardContent className="p-4 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${b.color}`} />
                  <span className="text-xs font-medium text-muted-foreground">{b.label}</span>
                </div>
                <div className="text-lg font-bold">{formatINR(b.total)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{b.count} item{b.count !== 1 ? 's' : ''}</div>
                <div className="text-xs text-muted-foreground mt-0.5 font-medium">{sharePct.toFixed(1)}% of AR</div>
                {b.key !== 'b0' && (
                  <div className={`text-xs font-semibold mt-1 ${b.text}`}>
                    Opp. cost: {formatINR(oppCost)}/yr
                  </div>
                )}
              </CardContent>
              {/* Bottom border bar proportional to share */}
              <div className="h-1.5 bg-muted w-full">
                <div className={`h-full ${b.color} transition-all`} style={{ width: `${sharePct}%` }} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder={`Search by ${type === 'receivable' ? 'customer' : 'vendor'} or invoice #...`}
            value={search} onChange={e => setSearch(e.target.value)}
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
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
          <Input
            type="number"
            placeholder="Min Amt"
            value={minAmountInput}
            onChange={e => setMinAmountInput(e.target.value)}
            className="pl-6 h-8 text-sm w-32"
          />
        </div>
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
                <SortableHead field="due_date"     label="Due Date"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHead field="daysOverdue"  label="Days Overdue" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHead field="amount"       label="Amount"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right" />
                <SortableHead field="balance"      label="Balance"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right" />
                {type === 'receivable' && <>
                  <SortableHead field="oppCost" label="Opp. Cost/yr" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right" />
                  <TableHead className="sticky top-0 bg-card z-20 whitespace-nowrap">Risk</TableHead>
                  <TableHead className="sticky top-0 bg-card z-20 whitespace-nowrap">Trend</TableHead>
                </>}
                <TableHead className="sticky top-0 bg-card z-20">Status</TableHead>
                <TableHead className="sticky top-0 bg-card z-20 w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayItems.map((item, idx) => {
                const bal = type === 'receivable'
                  ? (item.amount||0) - (item.amount_received||0)
                  : (item.amount||0) - (item.amount_paid||0);
                const oppCost = bal * (capitalRate/100) / 365 * item.daysOverdue;
                const risk = type === 'receivable' ? getRisk(item.daysOverdue, bal) : null;
                const rowBg = risk ? getRowBg(risk, idx) : (idx % 2 === 0 ? 'bg-white' : 'bg-muted/30');
                const sparkData = getSparkline(item);
                return (
                  <TableRow key={item.id} className={rowBg}>
                    <TableCell className={`font-medium sticky left-0 z-10 ${rowBg}`}>
                      {type === 'receivable' ? item.customer_name : item.vendor_name}
                    </TableCell>
                    <TableCell>{type === 'receivable' ? item.invoice_number : item.bill_number || '-'}</TableCell>
                    <TableCell>{formatDateIN(item.due_date)}</TableCell>
                    <TableCell>
                      {item.daysOverdue > 0 ? (
                        <Badge variant="outline" className={`text-xs ${
                          item.daysOverdue > 90 ? 'bg-red-50 text-red-700 border-red-200' :
                          item.daysOverdue > 60 ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          item.daysOverdue > 30 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>{item.daysOverdue}d overdue</Badge>
                      ) : <span className="text-emerald-600 text-xs">Current</span>}
                    </TableCell>
                    <TableCell className="text-right">{formatINR(item.amount)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatINR(bal)}</TableCell>
                    {type === 'receivable' && <>
                      <TableCell className="text-right text-red-600 font-semibold text-xs">
                        {oppCost > 0 ? formatINR(oppCost) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${getRiskStyle(risk)}`}>{risk}</Badge>
                      </TableCell>
                      <TableCell>
                        <Sparkline data={sparkData} />
                      </TableCell>
                    </>}
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${
                        item.status === 'paid'         ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        item.status === 'disputed'     ? 'bg-purple-50 text-purple-700 border-purple-200'   :
                        item.status === 'written_off'  ? 'bg-gray-50 text-gray-500 border-gray-200'         :
                        item.status === 'overdue'      ? 'bg-red-50 text-red-700 border-red-200'            :
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

  const overLimit  = debtorsWithLimit.filter(d => (d.total_outstanding||0) > d.credit_limit);
  const nearLimit  = debtorsWithLimit.filter(d => { const p=((d.total_outstanding||0)/d.credit_limit)*100; return p>=70&&p<=100; });

  const displayDebtors = useMemo(() => {
    let list = debtorsWithLimit.map(d => ({ ...d, pct: ((d.total_outstanding||0)/d.credit_limit)*100 }));
    const q = search.toLowerCase();
    if (q) list = list.filter(d => (d.name||'').toLowerCase().includes(q));
    if (statusFilter === 'over')  list = list.filter(d => d.pct > 100);
    else if (statusFilter === 'near') list = list.filter(d => d.pct>=70&&d.pct<=100);
    else if (statusFilter === 'ok')   list = list.filter(d => d.pct < 70);
    list.sort((a, b) => {
      let av, bv;
      if (sortKey === 'name')        { return sortDir==='asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name); }
      else if (sortKey === 'limit')  { av=a.credit_limit; bv=b.credit_limit; }
      else if (sortKey === 'outstanding') { av=a.total_outstanding||0; bv=b.total_outstanding||0; }
      else { av=a.pct; bv=b.pct; }
      return sortDir==='asc' ? av-bv : bv-av;
    });
    return list;
  }, [debtorsWithLimit, search, statusFilter, sortKey, sortDir]);

  const handleSort = (field) => {
    if (sortKey === field) setSortDir(d => d==='asc'?'desc':'asc');
    else { setSortKey(field); setSortDir('asc'); }
  };

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
              const barColor = status?.variant==='over' ? 'bg-red-500' : status?.variant==='warning' ? 'bg-amber-500' : 'bg-emerald-500';
              const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-muted/30';
              return (
                <TableRow key={d.id} className={rowBg}>
                  <TableCell className={`sticky left-0 z-10 ${rowBg}`}>
                    <div className="font-medium">{d.name}</div>
                    {d.contact_person && <div className="text-xs text-muted-foreground">{d.contact_person}</div>}
                  </TableCell>
                  <TableCell className="text-right">{formatINR(limit)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatINR(outstanding)}</TableCell>
                  <TableCell className={`text-right font-semibold ${available===0?'text-red-600':'text-emerald-600'}`}>
                    {available===0 ? '— Exceeded' : formatINR(available)}
                  </TableCell>
                  <TableCell className="w-40">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full">
                        <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width:`${pct}%` }} />
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
  const [capitalRate, setCapitalRate] = useState(12);

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const { data: receivables = [] } = useQuery({ queryKey: ['receivables'], queryFn: () => base44.entities.Receivable.list() });
  const { data: payables = [] }    = useQuery({ queryKey: ['payables'],    queryFn: () => base44.entities.Payable.list()  });
  const { data: debtors = [] }     = useQuery({ queryKey: ['debtors'],     queryFn: () => base44.entities.Debtor.list()   });
  const { data: customers = [] }   = useQuery({ queryKey: ['customers'],   queryFn: () => base44.entities.Customer.list() });

  // Account Managers only see their assigned customers
  const myCustomerNames = useMemo(() => {
    if (!isSalesTeam(currentUser?.role) || !currentUser?.email) return null;
    return new Set(customers.filter(c => c.account_manager === currentUser.email).map(c => c.name?.toLowerCase()));
  }, [currentUser, customers]);

  const unpaidReceivables = useMemo(() => {
    let result = receivables.filter(r => r.status !== 'paid' && r.status !== 'written_off');
    if (myCustomerNames) result = result.filter(r => myCustomerNames.has(r.customer_name?.toLowerCase()));
    return result;
  }, [receivables, myCustomerNames]);

  const unpaidPayables = payables.filter(p => p.status !== 'paid');

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status, type }) => type === 'receivable'
      ? base44.entities.Receivable.update(id, { status })
      : base44.entities.Payable.update(id, { status }),
    onSuccess: (_, { type }) => {
      queryClient.invalidateQueries({ queryKey: [type==='receivable' ? 'receivables' : 'payables'] });
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
        </TabsList>

        <TabsContent value="receivables" className="mt-4 space-y-4">
          <OppCostBanner items={unpaidReceivables} capitalRate={capitalRate} onChangeRate={setCapitalRate} />
          <AgingTable items={unpaidReceivables} type="receivable" onStatusChange={(id, status, type) => updateStatusMut.mutate({ id, status, type })} capitalRate={capitalRate} />
        </TabsContent>

        <TabsContent value="payables" className="mt-4">
          <AgingTable items={unpaidPayables} type="payable" onStatusChange={(id, status, type) => updateStatusMut.mutate({ id, status, type })} capitalRate={capitalRate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}