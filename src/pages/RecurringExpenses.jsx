/**
 * RecurringExpenses.jsx
 * © 2025 CEOITBOX Tech Services LLP. All rights reserved.
 * https://www.ceoitbox.com
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR, formatDateIN } from '@/lib/utils/currency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, CheckCircle, RefreshCw, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import AddSampleRecurringButton from '@/components/expenses/AddSampleRecurringButton';

function getISOWeekLabel(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const w1 = new Date(d.getFullYear(), 0, 4);
  const wn = 1 + Math.round(((d - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
  return `W${wn} '${String(d.getFullYear()).slice(2)}`;
}
function getMonthLabel(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

const ITEMS_PER_PAGE = 50;

const RECURRENCE_LABELS = {
  daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', custom: 'Custom',
};

const CATEGORY_LABELS = {
  travel: 'Travel', office_supplies: 'Office Supplies', meals: 'Meals',
  utilities: 'Utilities', rent: 'Rent', salary: 'Salary',
  marketing: 'Marketing', software: 'Software', maintenance: 'Maintenance',
  miscellaneous: 'Miscellaneous',
};

function loadApprovalThreshold() {
  try {
    const s = JSON.parse(localStorage.getItem('cashflow_pro_settings') || '{}');
    return Number(s.approvalThreshold) || 0;
  } catch { return 0; }
}

export default function RecurringExpenses() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [generating, setGenerating] = useState(false);
  const [currentPageTemplates, setCurrentPageTemplates] = useState(1);
  const [currentPageInstances, setCurrentPageInstances] = useState(1);
  const [sortTemplates, setSortTemplates] = useState({ key: 'description', dir: 'asc' });
  const [sortInstances, setSortInstances] = useState({ key: 'expense_date', dir: 'asc' });

  const makeSortHeader = (sortConfig, setSortConfig) => ({ col, label }) => (
    <TableHead className="cursor-pointer select-none whitespace-nowrap sticky top-0 bg-card z-10" onClick={() => setSortConfig(s => ({ key: col, dir: s.key === col && s.dir === 'asc' ? 'desc' : 'asc' }))}>
      <span className="inline-flex items-center gap-1">{label}
        <span className={sortConfig.key === col ? 'opacity-100 text-primary' : 'opacity-30'}>
          {sortConfig.key === col && sortConfig.dir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </span>
      </span>
    </TableHead>
  );

  const SortHeaderT = makeSortHeader(sortTemplates, setSortTemplates);
  const SortHeaderI = makeSortHeader(sortInstances, setSortInstances);
  const approvalThreshold = loadApprovalThreshold();

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const { data: allExpenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-expense_date'),
  });

  // Templates: recurring parent records
  const templates = useMemo(() =>
    allExpenses.filter(e => e.recurrence_type && e.recurrence_type !== 'none' && !e.parent_expense_id),
    [allExpenses]
  );

  // Generated instances
  const instances = useMemo(() =>
    allExpenses.filter(e => !!e.parent_expense_id).sort((a, b) => a.expense_date.localeCompare(b.expense_date)),
    [allExpenses]
  );

  const sortedTemplates = useMemo(() => [...templates].sort((a, b) => {
    const av = a[sortTemplates.key], bv = b[sortTemplates.key];
    const c = typeof av === 'number' ? av - bv : String(av || '').localeCompare(String(bv || ''));
    return sortTemplates.dir === 'asc' ? c : -c;
  }), [templates, sortTemplates]);

  const paginatedTemplates = useMemo(() => {
    const start = (currentPageTemplates - 1) * ITEMS_PER_PAGE;
    return sortedTemplates.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedTemplates, currentPageTemplates]);

  const totalPagesTemplates = Math.ceil(sortedTemplates.length / ITEMS_PER_PAGE);

  const sortedInstances = useMemo(() => [...instances].sort((a, b) => {
    const av = a[sortInstances.key], bv = b[sortInstances.key];
    const c = typeof av === 'number' ? av - bv : String(av || '').localeCompare(String(bv || ''));
    return sortInstances.dir === 'asc' ? c : -c;
  }), [instances, sortInstances]);

  const paginatedInstances = useMemo(() => {
    const start = (currentPageInstances - 1) * ITEMS_PER_PAGE;
    return sortedInstances.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedInstances, currentPageInstances]);

  const totalPagesInstances = Math.ceil(sortedInstances.length / ITEMS_PER_PAGE);

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Expense.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Expense.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Expense.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); setShowForm(false); },
  });

  const handleSave = async (form) => {
    if (editData) {
      await updateMut.mutateAsync({ id: editData.id, data: form });
      toast({ title: 'Template updated' });
      setShowForm(false); setEditData(null);
    } else {
      const data = {
        ...form,
        approval_status: 'not_required',
        submitted_by: currentUser?.email || '',
        submitted_by_name: currentUser?.full_name || '',
        recurrence_start_date: form.recurrence_start_date || form.expense_date,
      };
      await createMut.mutateAsync(data);
      toast({ title: 'Recurring expense created' });
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm('Delete this template? All future generated instances will also be deleted.')) return;
    // Delete all generated instances first
    const children = instances.filter(i => i.parent_expense_id === id);
    await Promise.all(children.map(c => deleteMut.mutateAsync(c.id)));
    await deleteMut.mutateAsync(id);
    toast({ title: 'Template deleted' });
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = (list) => {
    if (list.every(e => selectedIds.has(e.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(list.map(e => e.id)));
    }
  };

  const markSelectedPaid = async () => {
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(id => updateMut.mutateAsync({ id, data: { payment_mode: 'bank_transfer', approval_status: 'not_required' } })));
    toast({ title: `${ids.length} expense(s) marked as paid` });
    setSelectedIds(new Set());
  };

  const deleteSelected = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected expense(s)?`)) return;
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(id => deleteMut.mutateAsync(id)));
    toast({ title: `${ids.length} expense(s) deleted` });
    setSelectedIds(new Set());
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const res = await base44.functions.invoke('generateRecurringExpenses', {});
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    toast({ title: `Generated ${res.data.instances_created} new expense(s)` });
    setGenerating(false);
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recurring Expenses"
        subtitle="Manage recurring expense templates and generated entries"
        actionLabel="New Template"
        onAction={() => { setEditData(null); setShowForm(true); }}
      />

      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" onClick={handleGenerate} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Generate Now
        </Button>
        <span className="text-xs text-muted-foreground">Generates up to 6 months of future entries</span>
        <AddSampleRecurringButton
          existingTemplates={templates}
          currentUser={currentUser}
          onAdded={() => queryClient.invalidateQueries({ queryKey: ['expenses'] })}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Active Templates</p>
          <p className="text-xl font-bold mt-1">{templates.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Generated Entries</p>
          <p className="text-xl font-bold mt-1">{instances.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Forecast Value</p>
          <p className="text-xl font-bold mt-1">{formatINR(instances.reduce((s, e) => s + (e.amount || 0), 0))}</p>
        </Card>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
          <TabsTrigger value="instances">Generated Entries ({instances.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {templates.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">No recurring templates. Create one to get started.</div>
              ) : (
                <Table>
                   <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                     <TableRow>
                       <SortHeaderT col="description" label="Description" />
                       <SortHeaderT col="category" label="Category" />
                       <SortHeaderT col="amount" label="Amount" />
                       <SortHeaderT col="recurrence_type" label="Frequency" />
                       <TableHead className="sticky top-0 bg-card z-10">Start Week</TableHead>
                       <TableHead className="sticky top-0 bg-card z-10">Start Month</TableHead>
                       <SortHeaderT col="recurrence_end_date" label="End Date" />
                       <TableHead className="sticky top-0 bg-card z-10">Actions</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                      {paginatedTemplates.map((t, idx) => (
                       <TableRow key={t.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                        <TableCell className="font-medium">{t.description}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{CATEGORY_LABELS[t.category] || t.category}</Badge></TableCell>
                        <TableCell className="font-semibold">{formatINR(t.amount)}</TableCell>
                        <TableCell>
                          <Badge className="bg-blue-100 text-blue-800 text-xs">
                            {RECURRENCE_LABELS[t.recurrence_type]}
                            {t.recurrence_type === 'custom' && t.recurrence_interval ? ` (every ${t.recurrence_interval} ${t.recurrence_unit}s)` : ''}
                          </Badge>
                        </TableCell>
                        <TableCell><span className="text-xs font-medium text-muted-foreground">{getISOWeekLabel(t.recurrence_start_date || t.expense_date) || '—'}</span></TableCell>
                        <TableCell><span className="text-xs text-muted-foreground">{getMonthLabel(t.recurrence_start_date || t.expense_date) || '—'}</span></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.recurrence_end_date ? formatDateIN(t.recurrence_end_date) : 'No end'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditData(t); setShowForm(true); }}>Edit</Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteTemplate(t.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {totalPagesTemplates > 1 && (
                <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/30">
                  <span className="text-sm text-muted-foreground">Page {currentPageTemplates} of {totalPagesTemplates} • Showing {paginatedTemplates.length} of {templates.length} templates</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={currentPageTemplates === 1} onClick={() => setCurrentPageTemplates(1)}>First</Button>
                    <Button size="sm" variant="outline" disabled={currentPageTemplates === 1} onClick={() => setCurrentPageTemplates(currentPageTemplates - 1)}>Previous</Button>
                    <Button size="sm" variant="outline" disabled={currentPageTemplates === totalPagesTemplates} onClick={() => setCurrentPageTemplates(currentPageTemplates + 1)}>Next</Button>
                    <Button size="sm" variant="outline" disabled={currentPageTemplates === totalPagesTemplates} onClick={() => setCurrentPageTemplates(totalPagesTemplates)}>Last</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

                  <TabsContent value="instances" className="mt-4">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-sm text-blue-700 font-medium">{selectedIds.size} selected</span>
              <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={markSelectedPaid}>
                <CheckCircle className="w-3.5 h-3.5" /> Mark Paid
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs border-red-300 text-destructive hover:bg-red-50" onClick={deleteSelected}>
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto" onClick={() => setSelectedIds(new Set())}>Clear</Button>
            </div>
          )}
          <Card>
            <CardContent className="p-0">
              {instances.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">No generated entries yet. Click "Generate Now" to create them.</div>
              ) : (
                <Table>
                   <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                     <TableRow>
                       <TableHead className="w-10 sticky top-0 bg-card z-10">
                         <Checkbox
                           checked={instances.length > 0 && instances.every(e => selectedIds.has(e.id))}
                           onCheckedChange={() => toggleAll(instances)}
                         />
                       </TableHead>
                       <SortHeaderI col="description" label="Description" />
                       <SortHeaderI col="category" label="Category" />
                       <SortHeaderI col="amount" label="Amount" />
                       <SortHeaderI col="expense_date" label="Date" />
                       <TableHead className="sticky top-0 bg-card z-10">Week</TableHead>
                       <TableHead className="sticky top-0 bg-card z-10">Month</TableHead>
                       <TableHead className="sticky top-0 bg-card z-10">Actions</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {paginatedInstances.map((e, idx) => {
                       const isPast = e.expense_date <= new Date().toISOString().split('T')[0];
                       return (
                         <TableRow key={e.id} className={selectedIds.has(e.id) ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                          <TableCell>
                            <Checkbox checked={selectedIds.has(e.id)} onCheckedChange={() => toggleSelect(e.id)} />
                          </TableCell>
                          <TableCell className="font-medium">{e.description}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{CATEGORY_LABELS[e.category] || e.category}</Badge></TableCell>
                          <TableCell className="font-semibold">{formatINR(e.amount)}</TableCell>
                          <TableCell>
                            <span className={`text-sm ${isPast ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                              {formatDateIN(e.expense_date)}
                            </span>
                          </TableCell>
                          <TableCell><span className="text-xs font-medium text-muted-foreground">{getISOWeekLabel(e.expense_date) || '—'}</span></TableCell>
                          <TableCell><span className="text-xs text-muted-foreground">{getMonthLabel(e.expense_date) || '—'}</span></TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={async () => {
                              if (confirm('Delete this entry?')) { await deleteMut.mutateAsync(e.id); toast({ title: 'Deleted' }); }
                            }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              {totalPagesInstances > 1 && (
                <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/30">
                  <span className="text-sm text-muted-foreground">Page {currentPageInstances} of {totalPagesInstances} • Showing {paginatedInstances.length} of {instances.length} entries</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={currentPageInstances === 1} onClick={() => setCurrentPageInstances(1)}>First</Button>
                    <Button size="sm" variant="outline" disabled={currentPageInstances === 1} onClick={() => setCurrentPageInstances(currentPageInstances - 1)}>Previous</Button>
                    <Button size="sm" variant="outline" disabled={currentPageInstances === totalPagesInstances} onClick={() => setCurrentPageInstances(currentPageInstances + 1)}>Next</Button>
                    <Button size="sm" variant="outline" disabled={currentPageInstances === totalPagesInstances} onClick={() => setCurrentPageInstances(totalPagesInstances)}>Last</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ExpenseForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditData(null); }}
        onSave={handleSave}
        editData={editData}
        approvalThreshold={approvalThreshold}
        forceRecurring
      />
    </div>
  );
}