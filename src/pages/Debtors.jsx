import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp, Search, Plus, Users } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import DebtorCard from '@/components/debtors/DebtorCard';
import DebtorForm from '@/components/debtors/DebtorForm';
import DebtorDetail from '@/components/debtors/DebtorDetail';
import DebtorProfile from '@/pages/DebtorProfile';
import { useToast } from '@/components/ui/use-toast';

export default function Debtors() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingDebtor, setEditingDebtor] = useState(null);
  const [viewingDebtor, setViewingDebtor] = useState(null); // for old modal (kept for compat)
  const [profileDebtorId, setProfileDebtorId] = useState(null); // full profile page
  const [showPaid, setShowPaid] = useState(false);
  const [search, setSearch] = useState('');
  const [filterManager, setFilterManager] = useState('all');

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
      // Update viewingDebtor if it was the one edited
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

  // Show profile page inline
  if (profileDebtorId) {
    return <DebtorProfile debtorId={profileDebtorId} onBack={() => setProfileDebtorId(null)} />;
  }

  // Filter & group
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
      return matchSearch && matchManager;
    });
  }, [debtors, search, filterManager]);

  const activeDebtors = filtered.filter(d => (d.total_outstanding || 0) > 0 || d.status === 'active');
  const paidDebtors = filtered.filter(d => (d.total_outstanding || 0) <= 0 && d.status !== 'active' || ((d.total_outstanding || 0) <= 0 && (d.total_invoiced || 0) > 0));

  const totalOutstanding = debtors.reduce((s, d) => s + (d.total_outstanding || 0), 0);
  const totalInvoiced = debtors.reduce((s, d) => s + (d.total_invoiced || 0), 0);
  const overdueCount = debtors.filter(d => d.status === 'active' && (d.total_outstanding || 0) > 0).length;

  // Summary stats
  const unpaidCount = debtors.filter(d => (d.total_outstanding || 0) > 0 && (d.total_received || 0) === 0).length;
  const partialCount = debtors.filter(d => (d.total_outstanding || 0) > 0 && (d.total_received || 0) > 0).length;
  const paidCount = debtors.filter(d => (d.total_outstanding || 0) <= 0 && (d.total_invoiced || 0) > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Debtors"
        subtitle={`${debtors.length} debtors · ${formatINR(totalOutstanding)} outstanding`}
        actionLabel="New Debtor"
        onAction={() => { setEditingDebtor(null); setShowForm(true); }}
      />

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-xs font-medium text-red-700">{unpaidCount} Unpaid</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-xs font-medium text-amber-700">{partialCount} Partial</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-medium text-emerald-700">{paidCount} Collected</span>
        </div>
        <div className="ml-auto text-sm text-muted-foreground">
          Total invoiced: <span className="font-semibold text-foreground">{formatINR(totalInvoiced)}</span>
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeDebtors.map(d => (
                  <DebtorCard
                    key={d.id}
                    debtor={d}
                    onClick={() => setProfileDebtorId(d.id)}
                  />
                ))}
              </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {paidDebtors.map(d => (
                    <DebtorCard
                      key={d.id}
                      debtor={d}
                      onClick={() => setProfileDebtorId(d.id)}
                    />
                  ))}
                </div>
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