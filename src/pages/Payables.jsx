/**
 * Payables.jsx
 * © 2025 CEOITBOX Tech Services LLP. All rights reserved.
 * https://www.ceoitbox.com
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR } from '@/lib/utils/currency';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Pencil, Trash2, Search, Upload, ChevronUp, ChevronDown, AlertTriangle, Calendar, TrendingDown, CheckCircle2, CreditCard, Banknote, Eye } from 'lucide-react';
import RecordPaymentModal from '@/components/vendors/RecordPaymentModal';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import PayableForm from '@/components/payables/PayableForm';
import PlanPaymentModal from '@/components/payables/PlanPaymentModal';
import { useToast } from '@/components/ui/use-toast';

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function getDaysUntilDue(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.floor((d - TODAY) / 86400000);
}

function getISOWeek(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const w1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
}

function getCurrentISOWeek() { return getISOWeek(TODAY.toISOString()); }

function getDueMonth(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function getPriority(p) {
  const days = getDaysUntilDue(p.due_date);
  const balance = (p.amount || 0) - (p.amount_paid || 0);
  if (p.status === 'paid') return 'paid';
  if (days !== null && days < 0) return 'critical';
  if (days !== null && days <= 7 && balance > 50000) return 'high';
  if (days !== null && days <= 30) return 'medium';
  return 'low';
}

function getUrgencyOrder(p) {
  if (p.status === 'paid') return 5;
  if (p.status === 'partially_paid') return 4;
  const days = getDaysUntilDue(p.due_date);
  if (days !== null && days < 0) return 1;
  if (days !== null && days <= 7) return 2;
  return 3;
}

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', className: 'bg-red-50 text-red-700 border-red-200' },
  high: { label: 'High', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  medium: { label: 'Medium', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  low: { label: 'Low', className: 'bg-gray-50 text-gray-600 border-gray-200' },
  paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

function WeekPill({ dateStr }) {
  const week = getISOWeek(dateStr);
  const curr = getCurrentISOWeek();
  if (week === '—') return <span className="text-xs text-muted-foreground">—</span>;
  const year = new Date(dateStr).getFullYear();
  const currYear = TODAY.getFullYear();
  const isPast = year < currYear || (year === currYear && week < curr);
  const isCurr = year === currYear && week === curr;
  const cls = isPast ? 'bg-red-50 text-red-600 border-red-200' : isCurr ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-500 border-gray-200';
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${cls}`}>W{week}</span>;
}

function VendorTooltip({ vendor, allPayables }) {
  const bills = allPayables.filter(p => p.vendor_name === vendor);
  const totalBilled = bills.reduce((s, p) => s + (p.amount || 0), 0);
  const totalPaid = bills.reduce((s, p) => s + (p.amount_paid || 0), 0);
  const overdueCount = bills.filter(p => p.status === 'overdue' || (getDaysUntilDue(p.due_date) !== null && getDaysUntilDue(p.due_date) < 0 && p.status !== 'paid')).length;
  const paidBills = bills.filter(p => p.status === 'paid' && p.bill_date && p.due_date);
  const avgDays = paidBills.length
    ? Math.round(paidBills.reduce((s, p) => s + Math.max(0, (new Date(p.due_date) - new Date(p.bill_date)) / 86400000), 0) / paidBills.length)
    : null;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help underline decoration-dotted">{vendor}</span>
        </TooltipTrigger>
        <TooltipContent className="p-3 space-y-1 text-xs max-w-[200px]" side="right">
          <p className="font-semibold text-sm mb-1">{vendor}</p>
          <p>Total Billed: <span className="font-medium">{formatINR(totalBilled)}</span></p>
          <p>Total Paid: <span className="font-medium text-emerald-600">{formatINR(totalPaid)}</span></p>
          {avgDays !== null && <p>Avg. Pay Terms: <span className="font-medium">{avgDays}d</span></p>}
          <p>Overdue Instances: <span className={`font-medium ${overdueCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{overdueCount}</span></p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function PartialProgressBar({ amount, amountPaid }) {
  const pct = amount > 0 ? Math.round((amountPaid / amount) * 100) : 0;
  return (
    <div className="space-y-0.5">
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground">{pct}% paid</p>
    </div>
  );
}

const ITEMS_PER_PAGE = 50;

export default function Payables() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterDuePeriod, setFilterDuePeriod] = useState('all');
  const [filterWeek, setFilterWeek] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: null, dir: 'asc' });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [payingPayable, setPayingPayable] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: payables = [], isLoading } = useQuery({
    queryKey: ['payables'],
    queryFn: () => base44.entities.Payable.list('-created_date'),
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => base44.entities.Vendor.list(),
  });

  const findVendorId = (p) => {
    if (p.vendor_id) return p.vendor_id;
    const match = vendors.find(v => v.name?.toLowerCase() === p.vendor_name?.toLowerCase());
    return match?.id || null;
  };

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Payable.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payables'] }); setShowForm(false); toast({ title: 'Payable created' }); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Payable.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payables'] }); setShowForm(false); setEditing(null); toast({ title: 'Payable updated' }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Payable.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payables'] }); toast({ title: 'Payable deleted' }); },
  });

  const handleSave = async (formData) => {
    if (editing) await updateMut.mutateAsync({ id: editing.id, data: formData });
    else await createMut.mutateAsync(formData);
  };

  // Summary metrics
  const summaryMetrics = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const wStart = startOfWeek.toISOString().split('T')[0];
    const wEnd = endOfWeek.toISOString().split('T')[0];

    let totalOutstanding = 0, overdue = 0, dueThisWeek = 0, paidThisMonth = 0;
    payables.forEach(p => {
      const balance = (p.amount || 0) - (p.amount_paid || 0);
      if (p.status !== 'paid') totalOutstanding += balance;
      const days = getDaysUntilDue(p.due_date);
      if (p.status !== 'paid' && days !== null && days < 0) overdue += balance;
      if (p.status !== 'paid' && p.due_date >= wStart && p.due_date <= wEnd) dueThisWeek += balance;
      if (p.status === 'paid' && p.due_date >= startOfMonth && p.due_date <= endOfMonth) paidThisMonth += (p.amount_paid || 0);
    });
    return { totalOutstanding, overdue, dueThisWeek, paidThisMonth };
  }, [payables]);

  // Cash impact
  const cashImpact = useMemo(() => {
    const now = new Date();
    const wEnd = new Date(now);
    wEnd.setDate(now.getDate() + 7);
    const wEndStr = wEnd.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    const overdueNow = payables.filter(p => p.status !== 'paid' && p.due_date && p.due_date < todayStr)
      .reduce((s, p) => s + ((p.amount || 0) - (p.amount_paid || 0)), 0);
    const dueWeek = payables.filter(p => p.status !== 'paid' && p.due_date && p.due_date >= todayStr && p.due_date <= wEndStr)
      .reduce((s, p) => s + ((p.amount || 0) - (p.amount_paid || 0)), 0);
    return { overdueNow, dueWeek };
  }, [payables]);

  const weekOptions = useMemo(() => {
    const s = new Set();
    payables.forEach(p => { const w = getISOWeek(p.due_date); if (w !== '—') s.add(`W${w} '${String(new Date(p.due_date).getFullYear()).slice(2)}`); });
    return [...s].sort();
  }, [payables]);

  const monthOptions = useMemo(() => {
    const s = new Set();
    payables.forEach(p => { if (p.due_date) s.add(getDueMonth(p.due_date)); });
    return [...s];
  }, [payables]);

  // Filtering
  const filtered = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const wEnd = new Date(now); wEnd.setDate(now.getDate() + 7);
    const wEndStr = wEnd.toISOString().split('T')[0];
    const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const nextMStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];
    const nextMEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split('T')[0];

    return payables.filter(p => {
      const matchSearch = !search ||
        (p.bill_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.vendor_name || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || p.status === filterStatus;
      const matchCategory = filterCategory === 'all' || p.category === filterCategory;
      let matchDue = true;
      if (filterDuePeriod !== 'all' && p.due_date) {
        if (filterDuePeriod === 'overdue') matchDue = p.due_date < todayStr && p.status !== 'paid';
        else if (filterDuePeriod === 'this_week') matchDue = p.due_date >= todayStr && p.due_date <= wEndStr;
        else if (filterDuePeriod === 'this_month') matchDue = p.due_date >= todayStr && p.due_date <= mEnd;
        else if (filterDuePeriod === 'next_month') matchDue = p.due_date >= nextMStart && p.due_date <= nextMEnd;
      }
      const wLabel = p.due_date && getISOWeek(p.due_date) !== '—' ? `W${getISOWeek(p.due_date)} '${String(new Date(p.due_date).getFullYear()).slice(2)}` : null;
      const matchWeek = filterWeek === 'all' || wLabel === filterWeek;
      const matchMonth = filterMonth === 'all' || getDueMonth(p.due_date) === filterMonth;
      return matchSearch && matchStatus && matchCategory && matchDue && matchWeek && matchMonth;
    });
  }, [payables, search, filterStatus, filterCategory, filterDuePeriod, filterWeek, filterMonth]);

  // Sort: urgency default, then custom sort
  const sortedFiltered = useMemo(() => {
    const base = [...filtered].sort((a, b) => {
      const ua = getUrgencyOrder(a), ub = getUrgencyOrder(b);
      if (ua !== ub) return ua - ub;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      return 0;
    });
    if (!sortConfig.key) return base;
    return [...base].sort((a, b) => {
      const av = a[sortConfig.key], bv = b[sortConfig.key];
      const c = typeof av === 'number' ? av - bv : String(av || '').localeCompare(String(bv || ''));
      return sortConfig.dir === 'asc' ? c : -c;
    });
  }, [filtered, sortConfig]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedFiltered.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedFiltered, currentPage]);

  const totalPages = Math.ceil(sortedFiltered.length / ITEMS_PER_PAGE);

  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectedBills = useMemo(() => payables.filter(p => selectedIds.has(p.id)), [payables, selectedIds]);
  const selectedTotal = useMemo(() => selectedBills.reduce((s, p) => s + ((p.amount || 0) - (p.amount_paid || 0)), 0), [selectedBills]);

  const SortHeader = ({ col, label }) => (
    <TableHead className="cursor-pointer select-none whitespace-nowrap sticky top-0 bg-card z-10 shadow-sm" onClick={() => setSortConfig(s => ({ key: col, dir: s.key === col && s.dir === 'asc' ? 'desc' : 'asc' }))}>
      <span className="inline-flex items-center gap-1">{label}<span className={sortConfig.key === col ? 'opacity-100 text-primary' : 'opacity-30'}>{sortConfig.key === col && sortConfig.dir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}</span></span>
    </TableHead>
  );

  return (
    <div className="space-y-5 pb-20">
      <PageHeader
        title="Payables"
        subtitle="Manage vendor bills and outgoing payments"
        actionLabel="New Payable"
        onAction={() => { setEditing(null); setShowForm(true); }}
      >
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/csv-import?type=payable')}>
          <Upload className="w-4 h-4" /> Bulk Import
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><CreditCard className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-xs text-muted-foreground">Total Outstanding</p><p className="text-lg font-bold text-foreground">{formatINR(summaryMetrics.totalOutstanding)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
          <div><p className="text-xs text-muted-foreground">Overdue</p><p className="text-lg font-bold text-red-600">{formatINR(summaryMetrics.overdue)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0"><Calendar className="w-5 h-5 text-amber-600" /></div>
          <div><p className="text-xs text-muted-foreground">Due This Week</p><p className="text-lg font-bold text-amber-600">{formatINR(summaryMetrics.dueThisWeek)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>
          <div><p className="text-xs text-muted-foreground">Paid This Month</p><p className="text-lg font-bold text-emerald-600">{formatINR(summaryMetrics.paidThisMonth)}</p></div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by vendor or bill #..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="partially_paid">Partially Paid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="raw_materials">Raw Materials</SelectItem>
            <SelectItem value="services">Services</SelectItem>
            <SelectItem value="rent">Rent</SelectItem>
            <SelectItem value="utilities">Utilities</SelectItem>
            <SelectItem value="salary">Salary</SelectItem>
            <SelectItem value="taxes">Taxes</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterDuePeriod} onValueChange={setFilterDuePeriod}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Due Period" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Periods</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="this_week">Due This Week</SelectItem>
            <SelectItem value="this_month">Due This Month</SelectItem>
            <SelectItem value="next_month">Due Next Month</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterWeek} onValueChange={setFilterWeek}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Week" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Weeks</SelectItem>
            {weekOptions.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Month" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {monthOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Cash Impact Banner */}
      {(cashImpact.overdueNow > 0 || cashImpact.dueWeek > 0) && (
        <div className="flex flex-wrap items-center gap-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <TrendingDown className="w-4 h-4 text-amber-600 shrink-0" />
          {cashImpact.overdueNow > 0 && (
            <span>Paying all overdue bills today requires <strong className="text-red-600">{formatINR(cashImpact.overdueNow)}</strong>.</span>
          )}
          {cashImpact.dueWeek > 0 && (
            <span>Paying all bills due this week requires <strong className="text-amber-700">{formatINR(cashImpact.dueWeek)}</strong>.</span>
          )}
        </div>
      )}

      <Card>
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Loading...</div>
        ) : payables.length === 0 ? (
          <EmptyState title="No payables yet" description="Track bills and payments to vendors" actionLabel="Add Payable" onAction={() => setShowForm(true)} />
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">No results match your filters</div>
        ) : (
          <>
          <div className="overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow>
                  <TableHead className="w-10 px-2">
                    <input type="checkbox" checked={sortedFiltered.length > 0 && sortedFiltered.every(p => selectedIds.has(p.id))} onChange={() => { const allSel = sortedFiltered.every(p => selectedIds.has(p.id)); setSelectedIds(prev => { const n = new Set(prev); sortedFiltered.forEach(p => allSel ? n.delete(p.id) : n.add(p.id)); return n; }); }} className="rounded border-input w-4 h-4 cursor-pointer" />
                  </TableHead>
                  <SortHeader col="bill_number" label="Bill #" />
                  <SortHeader col="vendor_name" label="Vendor" />
                  <SortHeader col="category" label="Category" />
                  <SortHeader col="amount" label="Amount" />
                  <SortHeader col="amount_paid" label="Paid" />
                  <TableHead className="sticky top-0 bg-card z-10 shadow-sm">Balance</TableHead>
                  <SortHeader col="due_date" label="Due Date" />
                  <TableHead className="sticky top-0 bg-card z-10 shadow-sm">Due Week</TableHead>
                  <TableHead className="sticky top-0 bg-card z-10 shadow-sm">Due Month</TableHead>
                  <TableHead className="sticky top-0 bg-card z-10 shadow-sm">Priority</TableHead>
                  <SortHeader col="status" label="Status" />
                  <TableHead className="sticky top-0 bg-card z-10 shadow-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((p) => {
                  const balance = (p.amount || 0) - (p.amount_paid || 0);
                  const days = getDaysUntilDue(p.due_date);
                  const isOverdue = p.status !== 'paid' && days !== null && days < 0;
                  const isDueThisWeek = p.status !== 'paid' && days !== null && days >= 0 && days <= 7;
                  const priority = getPriority(p);
                  const pc = PRIORITY_CONFIG[priority];
                  const rowIdx = paginatedData.indexOf(p);
                  const rowCls = isOverdue ? 'bg-red-50/40' : isDueThisWeek ? 'bg-amber-50/40' : rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
                  return (
                    <TableRow key={p.id} className={`group ${rowCls}`}>
                      <TableCell className="px-2" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded border-input w-4 h-4 cursor-pointer" />
                      </TableCell>
                      <TableCell className="font-medium">{p.bill_number || '-'}</TableCell>
                      <TableCell><VendorTooltip vendor={p.vendor_name} allPayables={payables} /></TableCell>
                      <TableCell className="capitalize text-muted-foreground text-sm">{p.category?.replace(/_/g, ' ') || '-'}</TableCell>
                      <TableCell className="text-right font-medium">{formatINR(p.amount || 0)}</TableCell>
                      <TableCell className="text-right text-emerald-600">{formatINR(p.amount_paid || 0)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-semibold">{formatINR(balance)}</span>
                          {p.status === 'partially_paid' && p.amount > 0 && (
                            <div className="w-20"><PartialProgressBar amount={p.amount} amountPaid={p.amount_paid || 0} /></div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="text-sm">{p.due_date ? new Date(p.due_date).toLocaleDateString('en-IN') : '—'}</span>
                          {isOverdue && (
                            <span className="block text-xs text-red-500 font-medium">{Math.abs(days)}d overdue</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><WeekPill dateStr={p.due_date} /></TableCell>
                      <TableCell><span className="text-xs text-muted-foreground whitespace-nowrap">{getDueMonth(p.due_date)}</span></TableCell>
                      <TableCell>
                        {priority !== 'paid' && (
                          <Badge variant="outline" className={`text-xs ${pc.className}`}>{pc.label}</Badge>
                        )}
                      </TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                           {(() => { const vid = findVendorId(p); return vid ? <DropdownMenuItem onClick={() => navigate(`/vendor/${vid}`)}><Eye className="w-4 h-4 mr-2" /> View Supplier Profile</DropdownMenuItem> : null; })()}
                           <DropdownMenuItem onClick={() => setPayingPayable(p)}><Banknote className="w-4 h-4 mr-2" /> Record Payment</DropdownMenuItem>
                           <DropdownMenuItem onClick={() => { setEditing(p); setShowForm(true); }}><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                           <DropdownMenuItem onClick={() => { if (confirm('Delete?')) deleteMut.mutate(p.id); }} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
            {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/30">
              <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages} • Showing {paginatedData.length} of {sortedFiltered.length} payables</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>First</Button>
                <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>Previous</Button>
                <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>Next</Button>
                <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>Last</Button>
              </div>
            </div>
            )}
            </>
            )}
            </Card>

      {/* Sticky Footer for bulk selection */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-6 py-3 bg-card border-t shadow-xl">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-foreground">{selectedIds.size} bill{selectedIds.size > 1 ? 's' : ''} selected</span>
            <span className="text-sm text-muted-foreground">Total: <span className="font-bold text-foreground">{formatINR(selectedTotal)}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8" onClick={() => setShowPlanModal(true)}>Plan Payment</Button>
            <Button size="sm" className="gap-1.5 h-8" onClick={async () => { for (const id of selectedIds) await updateMut.mutateAsync({ id, data: { status: 'paid', amount_paid: payables.find(p => p.id === id)?.amount || 0 } }); setSelectedIds(new Set()); toast({ title: 'Marked as paid' }); }}>Mark as Paid</Button>
            <Button size="sm" variant="destructive" className="gap-1.5 h-8" onClick={async () => { if (!confirm(`Delete ${selectedIds.size} payables?`)) return; for (const id of selectedIds) await deleteMut.mutateAsync(id); setSelectedIds(new Set()); }}><Trash2 className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      <PayableForm open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} onSave={handleSave} editData={editing} />
      <RecordPaymentModal open={!!payingPayable} payable={payingPayable} onClose={() => setPayingPayable(null)} />
      <PlanPaymentModal
        open={showPlanModal}
        selectedBills={selectedBills}
        onClose={(result) => {
          setShowPlanModal(false);
          if (result) toast({ title: 'Payment plan saved', description: `Scheduled for ${result.paymentDate}${result.note ? ` — ${result.note}` : ''}` });
        }}
      />
    </div>
  );
}