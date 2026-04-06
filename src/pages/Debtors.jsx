import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp, Search, Users, LayoutGrid, List, X, Trash2 } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import DebtorCard from '@/components/debtors/DebtorCard';
import DebtorTableRow from '@/components/debtors/DebtorTableRow';
import DebtorForm from '@/components/debtors/DebtorForm';
import DebtorDetail from '@/components/debtors/DebtorDetail';
import DebtorProfile from '@/pages/DebtorProfile';
import OverdueAlertBanner from '@/components/debtors/OverdueAlertBanner';
import DebtorAnalyticsCards from '@/components/debtors/DebtorAnalyticsCards';
import { useToast } from '@/components/ui/use-toast';

const VIEW_MODES = [
  { key: 'card', icon: LayoutGrid, label: 'Card' },
  { key: 'table', icon: List, label: 'Table' },
];

export default function Debtors() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingDebtor, setEditingDebtor] = useState(null);
  const [viewingDebtor, setViewingDebtor] = useState(null);
  const [profileDebtorId, setProfileDebtorId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('profile') || null;
  });
  const [showPaid, setShowPaid] = useState(false);
  const [search, setSearch] = useState('');
  const [filterManager, setFilterManager] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAmount, setFilterAmount] = useState('all');
  const [filterDebtorStatus, setFilterDebtorStatus] = useState('all');
  const [filterDaysOverdue, setFilterDaysOverdue] = useState('all');
  const [viewMode, setViewMode] = useState('table');
  const [sortConfig, setSortConfig] = useState({ key: null, dir: 'asc' });
  const [selectedIds, setSelectedIds] = useState(new Set());

  const { data: debtors = [], isLoading } = useQuery({
    queryKey: ['debtors'],
    queryFn: () => base44.entities.Debtor.list('-created_date'),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list('-payment_date', 200),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-due_date', 1000),
  });

  const { data: receivables = [] } = useQuery({
    queryKey: ['receivables'],
    queryFn: () => base44.entities.Receivable.list(),
  });

  // Build a map of customer_name -> totals from Receivables (to sync with Debtors that have 0 totals)
  const receivableTotalsMap = useMemo(() => {
    const map = {};
    receivables.forEach(r => {
      const name = r.customer_name?.toLowerCase();
      if (!name) return;
      if (!map[name]) map[name] = { total_invoiced: 0, total_received: 0, total_outstanding: 0 };
      map[name].total_invoiced += r.amount || 0;
      map[name].total_received += r.amount_received || 0;
      map[name].total_outstanding += (r.amount || 0) - (r.amount_received || 0);
    });
    return map;
  }, [receivables]);

  // Merge receivable totals into debtors that have no invoiced amount recorded
  const mergedDebtors = useMemo(() => {
    return debtors.map(d => {
      if ((d.total_invoiced || 0) > 0) return d; // already has data, skip
      const key = d.name?.toLowerCase();
      const rtotals = key ? receivableTotalsMap[key] : null;
      if (!rtotals) return d;
      return { ...d, ...rtotals };
    });
  }, [debtors, receivableTotalsMap]);

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Debtor.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debtors'] });
      setShowForm(false);
      setEditingDebtor(null);
      toast({ title: 'Debtor created' });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Debtor.update(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['debtors'] });
      setShowForm(false);
      setEditingDebtor(null);
      if (viewingDebtor?.id === updated.id) setViewingDebtor(updated);
      toast({ title: 'Debtor updated' });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Debtor.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['debtors'] }); toast({ title: 'Deleted' }); },
  });

  const handleSave = (data) => {
    if (editingDebtor) updateMut.mutate({ id: editingDebtor.id, data });
    else createMut.mutate(data);
  };

  const handleEditDebtor = () => {
    setEditingDebtor(viewingDebtor);
    setShowForm(true);
  };

  // All hooks before conditional return
  const managers = useMemo(() => {
    const set = new Set(mergedDebtors.map(d => d.assigned_manager).filter(Boolean));
    return Array.from(set);
  }, [debtors]);

  const filtered = useMemo(() => {
    return mergedDebtors.filter(d => {
      const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) ||
        (d.contact_person || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.email || '').toLowerCase().includes(search.toLowerCase());
      const matchManager = filterManager === 'all' || d.assigned_manager === filterManager;
      const outstanding = d.total_outstanding || 0;
      const received = d.total_received || 0;
      const invoiced = d.total_invoiced || 0;
      const matchStatus =
        filterStatus === 'all' ? true :
        filterStatus === 'unpaid' ? outstanding > 0 && received === 0 :
        filterStatus === 'partial' ? outstanding > 0 && received > 0 :
        filterStatus === 'paid' ? outstanding <= 0 && invoiced > 0 :
        true;
      
      const matchAmount =
        filterAmount === 'all' ? true :
        filterAmount === 'high' ? outstanding > 100000 :
        filterAmount === 'medium' ? outstanding > 10000 && outstanding <= 100000 :
        filterAmount === 'low' ? outstanding > 0 && outstanding <= 10000 :
        true;
      
      const matchDebtorStatus = filterDebtorStatus === 'all' || d.status === filterDebtorStatus;

      let matchDaysOverdue = true;
      if (filterDaysOverdue !== 'all') {
        const today = new Date();
        const created = new Date(d.created_date);
        const daysOut = Math.floor((today - created) / (1000 * 60 * 60 * 24));
        if (filterDaysOverdue === '0-30') matchDaysOverdue = daysOut >= 0 && daysOut <= 30;
        else if (filterDaysOverdue === '30-60') matchDaysOverdue = daysOut > 30 && daysOut <= 60;
        else if (filterDaysOverdue === '60+') matchDaysOverdue = daysOut > 60;
      }
      
      return matchSearch && matchManager && matchStatus && matchAmount && matchDebtorStatus && matchDaysOverdue;
    });
  }, [mergedDebtors, search, filterManager, filterStatus, filterAmount, filterDebtorStatus]);

  // Sort debtors: overdue first, then other outstanding, then paid
  const sortedDebtors = useMemo(() => {
    const today = new Date();
    const overdue = filtered.filter(d => {
      const outstanding = d.total_outstanding || 0;
      return outstanding > 0 && d.status !== 'paid';
    }).sort((a, b) => {
      // Within overdue, prioritize those with overdue dates
      const aHasOverdue = (a.total_outstanding || 0) > 0;
      const bHasOverdue = (b.total_outstanding || 0) > 0;
      return bHasOverdue - aHasOverdue;
    });
    
    const activeDebtors = filtered.filter(d => (d.total_outstanding || 0) > 0 || d.status === 'active');
    const paidDebtors = filtered.filter(d =>
      ((d.total_outstanding || 0) <= 0 && d.status !== 'active') ||
      ((d.total_outstanding || 0) <= 0 && (d.total_invoiced || 0) > 0)
    );
    
    return { overdue, activeDebtors, paidDebtors };
  }, [filtered]);

  const nextDueDateMap = useMemo(() => {
    const map = {};
    [...invoices]
      .filter(inv => inv.status !== 'paid' && inv.due_date && inv.debtor_id)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .forEach(inv => { if (!map[inv.debtor_id]) map[inv.debtor_id] = inv.due_date; });
    return map;
  }, [invoices]);

  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const totalOutstanding = mergedDebtors.reduce((s, d) => s + (d.total_outstanding || 0), 0);
  const totalInvoiced = mergedDebtors.reduce((s, d) => s + (d.total_invoiced || 0), 0);
  const unpaidCount = mergedDebtors.filter(d => (d.total_outstanding || 0) > 0 && (d.total_received || 0) === 0).length;
  const partialCount = mergedDebtors.filter(d => (d.total_outstanding || 0) > 0 && (d.total_received || 0) > 0).length;
  const paidCount = mergedDebtors.filter(d => (d.total_outstanding || 0) <= 0 && (d.total_invoiced || 0) > 0).length;

  // Conditional return after all hooks
  if (profileDebtorId) {
    return <DebtorProfile debtorId={profileDebtorId} onBack={() => setProfileDebtorId(null)} />;
  }

  const renderCardView = (list) => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {list.map(d => (
        <div key={d.id} className="cursor-pointer" onClick={() => setProfileDebtorId(d.id)}>
          <DebtorCard debtor={d} />
        </div>
      ))}
    </div>
  );

  const renderTableView = (list) => {
    const getSortVal = (d) => {
      if (sortConfig.key === 'nextDueDate') return nextDueDateMap[d.id] || 'zzzz';
      return d[sortConfig.key];
    };
    const sorted = sortConfig.key
      ? [...list].sort((a, b) => {
          const av = getSortVal(a), bv = getSortVal(b);
          const c = typeof av === 'number' ? av - bv : String(av || '').localeCompare(String(bv || ''));
          return sortConfig.dir === 'asc' ? c : -c;
        })
      : list;
    const allSel = sorted.length > 0 && sorted.every(d => selectedIds.has(d.id));
    const SortHead = ({ col, label, className = '' }) => (
      <TableHead
        className={`cursor-pointer select-none whitespace-nowrap sticky top-0 bg-card z-10 shadow-sm ${className}`}
        onClick={() => setSortConfig(s => ({ key: col, dir: s.key === col && s.dir === 'asc' ? 'desc' : 'asc' }))}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <span className={`transition-opacity ${sortConfig.key === col ? 'opacity-100 text-primary' : 'opacity-30'}`}>
            {sortConfig.key === col && sortConfig.dir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </span>
        </span>
      </TableHead>
    );
    return (
      <Card className="overflow-hidden">
        <div className="overflow-auto max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 px-2 sticky top-0 bg-card z-10 shadow-sm">
                  <input
                    type="checkbox"
                    checked={allSel}
                    onChange={() => setSelectedIds(prev => {
                      const n = new Set(prev);
                      sorted.forEach(d => allSel ? n.delete(d.id) : n.add(d.id));
                      return n;
                    })}
                    className="rounded border-input w-4 h-4 cursor-pointer"
                  />
                </TableHead>
                <SortHead col="name" label="Name" />
                <TableHead className="sticky top-0 bg-card z-10 shadow-sm">Contact</TableHead>
                <SortHead col="total_invoiced" label="Invoiced" className="text-right" />
                <SortHead col="total_received" label="Received" className="text-right" />
                <SortHead col="total_outstanding" label="Outstanding" className="text-right" />
                <TableHead className="sticky top-0 bg-card z-10 shadow-sm">Progress</TableHead>
                <TableHead className="sticky top-0 bg-card z-10 shadow-sm">Status</TableHead>
                <TableHead className="sticky top-0 bg-card z-10 shadow-sm">Credit</TableHead>
                <SortHead col="assigned_manager" label="Manager" />
                <SortHead col="nextDueDate" label="Due Date" />
                <TableHead className="sticky top-0 bg-card z-10 shadow-sm">Due Week</TableHead>
                <TableHead className="sticky top-0 bg-card z-10 shadow-sm">Due Month</TableHead>
                <TableHead className="sticky top-0 bg-card z-10 shadow-sm">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(d => (
                <DebtorTableRow
                  key={d.id}
                  debtor={d}
                  onClick={() => setProfileDebtorId(d.id)}
                  checked={selectedIds.has(d.id)}
                  onCheck={() => toggleSelect(d.id)}
                  nextDueDate={nextDueDateMap[d.id] || null}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    );
  };

  const overdueDebtors = mergedDebtors.filter(d => (d.total_outstanding || 0) > 0);

  return (
    <div className="space-y-5">
      <OverdueAlertBanner overdueDebtors={overdueDebtors} />
      <PageHeader
        title="Debtors"
        subtitle={`${mergedDebtors.length} debtors · ${formatINR(totalOutstanding)} outstanding`}
        actionLabel="New Debtor"
        onAction={() => { setEditingDebtor(null); setShowForm(true); }}
      >
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-sm" onClick={() => navigate('/csv-import?type=debtor')}>
          📥 Bulk CSV Import
        </Button>
      </PageHeader>

      {/* Analytics Cards */}
      <DebtorAnalyticsCards debtors={mergedDebtors} payments={payments} />

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={() => setFilterStatus(filterStatus === 'unpaid' ? 'all' : 'unpaid')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${filterStatus === 'unpaid' ? 'bg-red-500 text-white border-red-500' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}
        >
          <div className={`w-2 h-2 rounded-full ${filterStatus === 'unpaid' ? 'bg-white' : 'bg-red-500'}`} />
          {unpaidCount} Unpaid
        </button>
        <button
          onClick={() => setFilterStatus(filterStatus === 'partial' ? 'all' : 'partial')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${filterStatus === 'partial' ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}
        >
          <div className={`w-2 h-2 rounded-full ${filterStatus === 'partial' ? 'bg-white' : 'bg-amber-500'}`} />
          {partialCount} Partial
        </button>
        <button
          onClick={() => setFilterStatus(filterStatus === 'paid' ? 'all' : 'paid')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${filterStatus === 'paid' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}
        >
          <div className={`w-2 h-2 rounded-full ${filterStatus === 'paid' ? 'bg-white' : 'bg-emerald-500'}`} />
          {paidCount} Collected
        </button>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">
            Total invoiced: <span className="font-semibold text-foreground">{formatINR(totalInvoiced)}</span>
          </span>
          <div className="flex items-center border rounded-lg p-0.5 bg-muted gap-0.5">
            {[{ key: 'card', icon: LayoutGrid, label: 'Card' }, { key: 'table', icon: List, label: 'Table' }].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                title={label}
                className={`p-1.5 rounded-md transition-colors ${viewMode === key ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search debtors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {managers.length > 0 && (
            <Select value={filterManager} onValueChange={setFilterManager}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Managers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Managers</SelectItem>
                {managers.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={filterAmount} onValueChange={setFilterAmount}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Outstanding Amount" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Amounts</SelectItem>
              <SelectItem value="high">{">"}₹1,00,000</SelectItem>
              <SelectItem value="medium">Medium (₹10,000 - ₹1,00,000)</SelectItem>
              <SelectItem value="low">Low (₹0 - ₹10,000)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterDebtorStatus} onValueChange={setFilterDebtorStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Debtor Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="written_off">Written Off</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterDaysOverdue} onValueChange={setFilterDaysOverdue}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Days Overdue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Days Overdue</SelectItem>
              <SelectItem value="0-30">0–30 days overdue</SelectItem>
              <SelectItem value="30-60">30–60 days overdue</SelectItem>
              <SelectItem value="60+">60+ days overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(search || filterManager !== 'all' || filterAmount !== 'all' || filterDebtorStatus !== 'all' || filterDaysOverdue !== 'all') && (
          <button
            onClick={() => {
              setSearch('');
              setFilterManager('all');
              setFilterAmount('all');
              setFilterDebtorStatus('all');
              setFilterDaysOverdue('all');
            }}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
            Clear all filters
          </button>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium text-primary">{selectedIds.size} debtor{selectedIds.size > 1 ? 's' : ''} selected</span>
          <Button size="sm" variant="destructive" className="gap-1.5 h-7"
            onClick={async () => {
              if (!confirm(`Delete ${selectedIds.size} debtors?`)) return;
              for (const id of selectedIds) await deleteMut.mutateAsync(id);
              setSelectedIds(new Set());
            }}>
            <Trash2 className="w-3.5 h-3.5" /> Delete Selected
          </Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : mergedDebtors.length === 0 ? (
        <EmptyState
          title="No debtors yet"
          description="Add debtors to start tracking invoices and collections"
          actionLabel="Add Debtor"
          onAction={() => setShowForm(true)}
          icon={Users}
        />
      ) : (
       <>
         {/* Overdue debtors */}
         {sortedDebtors.overdue.length > 0 && (
           <div>
             <h2 className="text-sm font-semibold text-destructive uppercase tracking-wide mb-3">
               ⚠️ Overdue — {sortedDebtors.overdue.length} debtor{sortedDebtors.overdue.length !== 1 ? 's' : ''}
             </h2>
             {viewMode === 'card' ? renderCardView(sortedDebtors.overdue) : renderTableView(sortedDebtors.overdue)}
           </div>
         )}

         {/* Other outstanding debtors */}
         {sortedDebtors.activeDebtors.length > sortedDebtors.overdue.length && (
           <div className="mt-6">
             <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
               Other Outstanding — {sortedDebtors.activeDebtors.length - sortedDebtors.overdue.length} debtor{(sortedDebtors.activeDebtors.length - sortedDebtors.overdue.length) !== 1 ? 's' : ''}
             </h2>
             {viewMode === 'card' ? renderCardView(sortedDebtors.activeDebtors.filter(d => !sortedDebtors.overdue.find(o => o.id === d.id))) : renderTableView(sortedDebtors.activeDebtors.filter(d => !sortedDebtors.overdue.find(o => o.id === d.id)))}
           </div>
         )}

         {sortedDebtors.overdue.length === 0 && sortedDebtors.activeDebtors.length === 0 && filtered.length > 0 && (
           <div className="text-center py-8 text-muted-foreground text-sm">No outstanding debtors match your filters</div>
         )}

         {/* Zero Payment (Paid) — collapsible */}
         {sortedDebtors.paidDebtors.length > 0 && (
           <div className="mt-6">
             <button
               className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 hover:text-foreground transition-colors"
               onClick={() => setShowPaid(p => !p)}
             >
               {showPaid ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
               Zero Payment — {sortedDebtors.paidDebtors.length} debtor{sortedDebtors.paidDebtors.length !== 1 ? 's' : ''}
               <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 ml-1">
                 {formatINR(sortedDebtors.paidDebtors.reduce((s, d) => s + (d.total_received || 0), 0))} collected
               </Badge>
             </button>
             {showPaid && (
               viewMode === 'card' ? renderCardView(sortedDebtors.paidDebtors) : renderTableView(sortedDebtors.paidDebtors)
             )}
           </div>
         )}
       </>
      )}

      <DebtorForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditingDebtor(null); }}
        onSave={handleSave}
        editData={editingDebtor}
      />

      <DebtorDetail
        debtor={viewingDebtor}
        open={!!viewingDebtor}
        onClose={() => setViewingDebtor(null)}
        onEditDebtor={handleEditDebtor}
      />
    </div>
  );
}