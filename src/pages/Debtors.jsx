import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp, Search, Users, LayoutGrid, List, BarChart2 } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import DebtorCard from '@/components/debtors/DebtorCard';
import DebtorTableRow from '@/components/debtors/DebtorTableRow';
import DebtorForm from '@/components/debtors/DebtorForm';
import DebtorDetail from '@/components/debtors/DebtorDetail';
import DebtorProfile from '@/pages/DebtorProfile';
import { useToast } from '@/components/ui/use-toast';

const VIEW_MODES = [
  { key: 'card', icon: LayoutGrid, label: 'Card' },
  { key: 'table', icon: List, label: 'Table' },
];

export default function Debtors() {
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
  const [viewMode, setViewMode] = useState('card');

  const { data: debtors = [], isLoading } = useQuery({
    queryKey: ['debtors'],
    queryFn: () => base44.entities.Debtor.list('-created_date'),
  });

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
    const set = new Set(debtors.map(d => d.assigned_manager).filter(Boolean));
    return Array.from(set);
  }, [debtors]);

  const filtered = useMemo(() => {
    return debtors.filter(d => {
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
      return matchSearch && matchManager && matchStatus;
    });
  }, [debtors, search, filterManager, filterStatus]);

  const activeDebtors = filtered.filter(d => (d.total_outstanding || 0) > 0 || d.status === 'active');
  const paidDebtors = filtered.filter(d =>
    ((d.total_outstanding || 0) <= 0 && d.status !== 'active') ||
    ((d.total_outstanding || 0) <= 0 && (d.total_invoiced || 0) > 0)
  );

  const totalOutstanding = debtors.reduce((s, d) => s + (d.total_outstanding || 0), 0);
  const totalInvoiced = debtors.reduce((s, d) => s + (d.total_invoiced || 0), 0);
  const unpaidCount = debtors.filter(d => (d.total_outstanding || 0) > 0 && (d.total_received || 0) === 0).length;
  const partialCount = debtors.filter(d => (d.total_outstanding || 0) > 0 && (d.total_received || 0) > 0).length;
  const paidCount = debtors.filter(d => (d.total_outstanding || 0) <= 0 && (d.total_invoiced || 0) > 0).length;

  // Conditional return after all hooks
  if (profileDebtorId) {
    return <DebtorProfile debtorId={profileDebtorId} onBack={() => setProfileDebtorId(null)} />;
  }

  const renderCardView = (list) => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {list.map(d => (
        <DebtorCard key={d.id} debtor={d} onClick={() => setProfileDebtorId(d.id)} />
      ))}
    </div>
  );

  const renderTableView = (list) => (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="text-right">Invoiced</TableHead>
            <TableHead className="text-right">Received</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Manager</TableHead>
            <TableHead className="w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map(d => (
            <DebtorTableRow key={d.id} debtor={d} onClick={() => setProfileDebtorId(d.id)} />
          ))}
        </TableBody>
      </Table>
    </Card>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Debtors"
        subtitle={`${debtors.length} debtors · ${formatINR(totalOutstanding)} outstanding`}
        actionLabel="New Debtor"
        onAction={() => { setEditingDebtor(null); setShowForm(true); }}
      />

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
          {/* View mode toggle */}
          <div className="flex items-center border rounded-lg p-0.5 bg-muted gap-0.5">
            {VIEW_MODES.map(({ key, icon: Icon, label }) => (
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
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search debtors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
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
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : debtors.length === 0 ? (
        <EmptyState
          title="No debtors yet"
          description="Add debtors to start tracking invoices and collections"
          actionLabel="Add Debtor"
          onAction={() => setShowForm(true)}
          icon={Users}
        />
      ) : (
        <>
          {/* Active debtors */}
          {activeDebtors.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Active — {activeDebtors.length} debtor{activeDebtors.length !== 1 ? 's' : ''}
              </h2>
              {viewMode === 'card' ? renderCardView(activeDebtors) : renderTableView(activeDebtors)}
            </div>
          )}

          {activeDebtors.length === 0 && filtered.length > 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">No active debtors match your filters</div>
          )}

          {/* Paid debtors — collapsible */}
          {paidDebtors.length > 0 && (
            <div className="mt-4">
              <button
                className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 hover:text-foreground transition-colors"
                onClick={() => setShowPaid(p => !p)}
              >
                {showPaid ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Payment Collected — {paidDebtors.length} debtor{paidDebtors.length !== 1 ? 's' : ''}
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 ml-1">
                  {formatINR(paidDebtors.reduce((s, d) => s + (d.total_received || 0), 0))} collected
                </Badge>
              </button>
              {showPaid && (
                viewMode === 'card' ? renderCardView(paidDebtors) : renderTableView(paidDebtors)
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