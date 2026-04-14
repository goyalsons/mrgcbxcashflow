import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Medal, Target, Plus, Pencil, Trash2, MoreHorizontal, Award, DollarSign, StickyNote, CheckSquare, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const EMPTY_FORM = {
  customer_name: '',
  manager_email: '',
  manager_name: '',
  target_amount: '',
  target_date: new Date().toISOString().split('T')[0],
  notes: '',
};

// ─── TargetForm ────────────────────────────────────────────────────────────────
function TargetForm({ open, onClose, onSave, editData, managers, receivableCustomers, outstandingByName }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (editData) {
      setForm({
        ...editData,
        target_amount: editData.target_amount?.toString() || '',
        target_date: editData.target_date || new Date().toISOString().split('T')[0],
      });
    } else {
      setForm({ ...EMPTY_FORM, target_date: new Date().toISOString().split('T')[0] });
    }
  }, [editData, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCustomerSelect = (name) => {
    const outstanding = outstandingByName[name.trim().toLowerCase()] || 0;
    setForm(f => ({
      ...f,
      customer_name: name,
      target_amount: outstanding > 0 ? outstanding.toString() : f.target_amount,
    }));
  };

  const handleManagerSelect = (email) => {
    const mgr = managers.find(m => m.email === email);
    setForm(f => ({
      ...f,
      manager_email: email,
      manager_name: mgr?.full_name || f.manager_name,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const date = new Date(form.target_date);
    await onSave({
      ...form,
      target_amount: parseFloat(form.target_amount) || 0,
      period_month: date.getMonth() + 1,
      period_year: date.getFullYear(),
    });
    setSaving(false);
  };

  const selectedOutstanding = form.customer_name
    ? (outstandingByName[form.customer_name.trim().toLowerCase()] || 0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editData ? 'Edit Target' : 'Assign Collection Target'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer — pick from receivable customers */}
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Select value={form.customer_name} onValueChange={handleCustomerSelect}>
              <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
              <SelectContent className="max-h-60">
                {receivableCustomers.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.customer_name && (
              <p className="text-xs text-muted-foreground">
                Outstanding:{' '}
                {selectedOutstanding > 0
                  ? <span className="font-semibold text-red-600">{formatINR(selectedOutstanding)}</span>
                  : <span className="text-muted-foreground">No outstanding recorded</span>
                }
              </p>
            )}
          </div>

          {/* Account Manager */}
          <div className="space-y-1.5">
            <Label>Account Manager *</Label>
            {managers.length > 0 ? (
              <Select value={form.manager_email} onValueChange={handleManagerSelect}>
                <SelectTrigger><SelectValue placeholder="Select manager..." /></SelectTrigger>
                <SelectContent>
                  {managers.map(m => (
                    <SelectItem key={m.email} value={m.email}>{m.full_name || m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={form.manager_name || form.manager_email}
                onChange={e => set('manager_name', e.target.value)}
                placeholder="Enter account manager name..."
              />
            )}
            {form.manager_email && managers.length > 0 && (
              <p className="text-xs text-muted-foreground">{form.manager_email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Target Amount (₹) *</Label>
            <Input type="number" value={form.target_amount} onChange={e => set('target_amount', e.target.value)} required min="1" placeholder="e.g. 500000" />
          </div>
          <div className="space-y-1.5">
            <Label>Target Date *</Label>
            <Input type="date" value={form.target_date} onChange={e => set('target_date', e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Optional notes..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || (!form.manager_email && !form.manager_name)}>
              {saving ? 'Saving...' : editData ? 'Update Target' : 'Assign Target'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── UpdateProgressDialog ──────────────────────────────────────────────────────
function UpdateProgressDialog({ open, onClose, target, currentUser, onSave }) {
  const [noteText, setNoteText] = useState('');
  const [addedAmount, setAddedAmount] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) { setNoteText(''); setAddedAmount(''); }
  }, [open, target?.id]);

  const existingNotes = useMemo(() => {
    if (!target?.progress_notes) return [];
    try { return JSON.parse(target.progress_notes); } catch { return []; }
  }, [target?.progress_notes]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!noteText.trim() && !addedAmount) return;
    setSaving(true);
    const extra = parseFloat(addedAmount) || 0;
    const newNote = {
      text: noteText.trim(),
      amount: extra,
      timestamp: new Date().toISOString(),
      author: currentUser?.full_name || currentUser?.email || 'Unknown',
    };
    const updatedNotes = [...existingNotes, newNote];
    await onSave(target.id, {
      collected_amount: (target.collected_amount || 0) + extra,
      progress_notes: JSON.stringify(updatedNotes),
    });
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Progress — {target?.manager_name || target?.manager_email}</DialogTitle>
        </DialogHeader>

        {/* Existing notes timeline */}
        {existingNotes.length > 0 && (
          <div className="max-h-52 overflow-y-auto space-y-2 border rounded-lg p-3 bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Progress History</p>
            {[...existingNotes].reverse().map((n, i) => (
              <div key={i} className="border-l-2 border-primary/40 pl-3 py-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(n.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {' · '}<span className="font-medium text-foreground">{n.author}</span>
                  </span>
                  {n.amount > 0 && (
                    <span className="text-xs font-semibold text-emerald-600 shrink-0">+{formatINR(n.amount)}</span>
                  )}
                </div>
                {n.text && <p className="text-sm mt-0.5 text-foreground">{n.text}</p>}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label>Amount Collected (₹)</Label>
            <Input type="number" min="0" value={addedAmount} onChange={e => setAddedAmount(e.target.value)} placeholder="Amount collected this update..." />
            {target?.collected_amount > 0 && (
              <p className="text-xs text-muted-foreground">Total so far: <span className="font-medium text-emerald-600">{formatINR(target.collected_amount)}</span></p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Note *</Label>
            <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2} placeholder="Add a progress note..." />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || (!noteText.trim() && !addedAmount)}>
              {saving ? 'Saving...' : 'Add Update'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── BulkEditDialog ────────────────────────────────────────────────────────────
function BulkEditDialog({ open, onClose, selectedIds, targets, onSave, onDelete }) {
  const [field, setField] = useState('collected_amount');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => { if (open) { setField('collected_amount'); setValue(''); } }, [open]);

  const selected = targets.filter(t => selectedIds.has(t.id));

  const handleSave = async () => {
    if (!value) return;
    setSaving(true);
    const updates = selected.map(t => {
      if (field === 'collected_amount') return { id: t.id, data: { collected_amount: parseFloat(value) || 0 } };
      if (field === 'target_amount') return { id: t.id, data: { target_amount: parseFloat(value) || 0 } };
      if (field === 'manager_email') return { id: t.id, data: { manager_email: value } };
      return null;
    }).filter(Boolean);
    await onSave(updates);
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} target(s)? This cannot be undone.`)) return;
    setSaving(true);
    await onDelete([...selectedIds]);
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Bulk Edit — {selectedIds.size} record(s)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Field to update</Label>
            <Select value={field} onValueChange={setField}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="collected_amount">Collected Amount (₹)</SelectItem>
                <SelectItem value="target_amount">Target Amount (₹)</SelectItem>
                <SelectItem value="manager_email">Manager Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>New Value</Label>
            <Input
              type={field === 'manager_email' ? 'email' : 'number'}
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={field === 'manager_email' ? 'email@example.com' : '0'}
            />
          </div>
          <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2 max-h-24 overflow-y-auto">
            {selected.map(t => <div key={t.id}>• {t.manager_name || t.manager_email} — {t.customer_name || 'No customer'}</div>)}
          </div>
          <div className="flex justify-between gap-2 pt-1">
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={saving}>
              <Trash2 className="w-3.5 h-3.5 mr-1" />Delete Selected
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !value}>
                {saving ? 'Saving...' : 'Apply'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── RankIcon ──────────────────────────────────────────────────────────────────
function RankIcon({ rank }) {
  if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
  if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
  return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">#{rank}</span>;
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CollectionTargets() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [updatingTarget, setUpdatingTarget] = useState(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [currentUser, setCurrentUser] = useState(null);

  React.useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  const { data: targets = [], isLoading } = useQuery({
    queryKey: ['collectionTargets'],
    queryFn: () => base44.entities.CollectionTarget.list('-created_date'),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['allPayments'],
    queryFn: () => base44.entities.Payment.list('-payment_date'),
  });

  const { data: receivables = [] } = useQuery({
    queryKey: ['allReceivables'],
    queryFn: () => base44.entities.Receivable.list(),
  });

  const managers = useMemo(() => allUsers.filter(u => u.role === 'account_manager' || u.role === 'admin'), [allUsers]);

  // Build outstanding map keyed by lowercase customer_name from receivables
  const outstandingByName = useMemo(() => {
    const map = {};
    receivables.forEach(r => {
      if (r.status === 'paid' || r.status === 'written_off') return;
      if (!r.customer_name) return;
      const key = r.customer_name.trim().toLowerCase();
      const outstanding = Math.max(0, (r.amount || 0) - (r.amount_received || 0));
      map[key] = (map[key] || 0) + outstanding;
    });
    return map;
  }, [receivables]);

  // Outstanding for a target record
  const getOutstanding = (t) => {
    if (!t.customer_name) return 0;
    return outstandingByName[t.customer_name.trim().toLowerCase()] || 0;
  };

  // Build manager->customer ids map for payment attribution
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  // Sorted unique customer names from the Customer entity
  const receivableCustomers = useMemo(() => {
    return [...customers].map(c => c.name).filter(Boolean).sort();
  }, [customers]);

  const managerCustomerIds = useMemo(() => {
    const map = {};
    customers.forEach(c => {
      if (c.account_manager) {
        if (!map[c.account_manager]) map[c.account_manager] = [];
        map[c.account_manager].push(c.id);
      }
    });
    return map;
  }, [customers]);

  // ── Mutations ──
  const createMut = useMutation({
    mutationFn: (data) => base44.entities.CollectionTarget.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['collectionTargets'] }); setShowForm(false); toast({ title: 'Target assigned' }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CollectionTarget.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['collectionTargets'] }); setShowForm(false); setEditingTarget(null); toast({ title: 'Target updated' }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.CollectionTarget.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['collectionTargets'] }); toast({ title: 'Target deleted' }); },
  });

  const handleSave = (data) => {
    if (editingTarget) updateMut.mutate({ id: editingTarget.id, data });
    else createMut.mutate(data);
  };

  const handleProgressSave = (id, data) => updateMut.mutateAsync({ id, data });

  const handleBulkSave = async (updates) => {
    await Promise.all(updates.map(u => base44.entities.CollectionTarget.update(u.id, u.data)));
    queryClient.invalidateQueries({ queryKey: ['collectionTargets'] });
    setSelectedIds(new Set());
    toast({ title: `${updates.length} record(s) updated` });
  };

  const handleBulkDelete = async (ids) => {
    await Promise.all(ids.map(id => base44.entities.CollectionTarget.delete(id)));
    queryClient.invalidateQueries({ queryKey: ['collectionTargets'] });
    setSelectedIds(new Set());
    toast({ title: `${ids.length} record(s) deleted` });
  };

  // ── Selection helpers ──
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === targets.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(targets.map(t => t.id)));
  };

  // ── Leaderboard data ──
  const monthlyTargets = useMemo(() => {
    const filtered = targets.filter(t => t.period_month === selectedMonth && t.period_year === selectedYear);
    return filtered.map(t => {
      const customerIds = managerCustomerIds[t.manager_email] || [];
      const monthPayments = payments.filter(p => {
        if (!p.payment_date) return false;
        const d = new Date(p.payment_date);
        return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear && customerIds.includes(p.debtor_id);
      });
      const autoCollected = monthPayments.reduce((s, p) => s + (p.amount || 0), 0);
      const collected = Math.max(autoCollected, t.collected_amount || 0);
      const pct = t.target_amount > 0 ? Math.min(100, Math.round((collected / t.target_amount) * 100)) : 0;
      return { ...t, collected, pct };
    }).sort((a, b) => b.pct - a.pct);
  }, [targets, selectedMonth, selectedYear, managerCustomerIds, payments]);

  const totalTarget = monthlyTargets.reduce((s, t) => s + (t.target_amount || 0), 0);
  const totalCollected = monthlyTargets.reduce((s, t) => s + t.collected, 0);
  const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalCollected / totalTarget) * 100)) : 0;

  const years = [selectedYear - 1, selectedYear, selectedYear + 1];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collection Targets"
        subtitle="Assign and track monthly collection targets for account managers"
        actionLabel="Assign Target"
        onAction={() => { setEditingTarget(null); setShowForm(true); }}
      />

      {/* Period Selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Period:</span>
        <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(parseInt(v))}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Overall Progress */}
      {monthlyTargets.length > 0 && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-xs font-medium text-muted-foreground">Team Overall — {MONTHS[selectedMonth - 1]} {selectedYear}</div>
                <div className="text-sm font-bold mt-0.5">{formatINR(totalCollected)} <span className="text-muted-foreground text-xs font-normal">/ {formatINR(totalTarget)}</span></div>
              </div>
              <div className="text-2xl font-bold text-primary">{overallPct}%</div>
            </div>
            <Progress value={overallPct} className="h-2" />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="targets">
        <TabsList>
          <TabsTrigger value="targets" className="gap-1.5"><Target className="w-3.5 h-3.5" />All Targets</TabsTrigger>
          <TabsTrigger value="leaderboard" className="gap-1.5"><Trophy className="w-3.5 h-3.5" />Leaderboard</TabsTrigger>
        </TabsList>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="mt-4">
          {monthlyTargets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No targets for this period</div>
          ) : (
            <div className="space-y-2">
              {monthlyTargets.map((t, idx) => (
                <Card key={t.id} className={idx === 0 ? 'border-yellow-200 bg-yellow-50/40' : ''}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 w-6 flex justify-center"><RankIcon rank={idx + 1} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <span className="text-sm font-semibold">{t.manager_name || t.manager_email}</span>
                            <span className="text-xs text-muted-foreground ml-1">{t.manager_email}</span>
                          </div>
                          <span className="font-bold text-primary text-sm">{t.pct}%</span>
                        </div>
                        <Progress value={t.pct} className="h-1.5" />
                        <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                          <span className="text-emerald-600 font-medium">{formatINR(t.collected)}</span>
                          <span>{formatINR(t.target_amount)}</span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingTarget(t); setShowForm(true); }}>
                            <Pencil className="w-3.5 h-3.5 mr-2" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Delete this target?')) deleteMut.mutate(t.id); }}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* All Targets Tab */}
        <TabsContent value="targets" className="mt-4">
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 mb-3 p-2 bg-primary/5 border border-primary/20 rounded-lg">
              <span className="text-sm font-medium text-primary">{selectedIds.size} selected</span>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowBulkEdit(true)}>
                <CheckSquare className="w-3.5 h-3.5" />Bulk Edit
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30"
                onClick={() => { if (confirm(`Delete ${selectedIds.size} target(s)?`)) handleBulkDelete([...selectedIds]); }}>
                <Trash2 className="w-3.5 h-3.5" />Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}><X className="w-3.5 h-3.5" /></Button>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div>
          ) : targets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-semibold text-muted-foreground">No targets assigned yet</p>
                <p className="text-sm text-muted-foreground mt-1">Assign monthly collection targets to account managers</p>
                <Button className="mt-4" onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" />Assign First Target</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <Checkbox
                        checked={selectedIds.size === targets.length && targets.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targets.map(t => {
                    const outstanding = getOutstanding(t);
                    const customerIds = managerCustomerIds[t.manager_email] || [];
                    const monthPayments = payments.filter(p => {
                      if (!p.payment_date) return false;
                      const d = new Date(p.payment_date);
                      return d.getMonth() + 1 === t.period_month && d.getFullYear() === t.period_year && customerIds.includes(p.debtor_id);
                    });
                    const autoCollected = monthPayments.reduce((s, p) => s + (p.amount || 0), 0);
                    const collected = Math.max(autoCollected, t.collected_amount || 0);
                    const pct = t.target_amount > 0 ? Math.min(100, Math.round((collected / t.target_amount) * 100)) : 0;
                    const notesCount = (() => { try { return JSON.parse(t.progress_notes || '[]').length; } catch { return 0; } })();
                    return (
                      <TableRow key={t.id} className={selectedIds.has(t.id) ? 'bg-primary/5' : ''}>
                        <TableCell>
                          <Checkbox checked={selectedIds.has(t.id)} onCheckedChange={() => toggleSelect(t.id)} />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{t.manager_name || t.manager_email}</div>
                          <div className="text-xs text-muted-foreground">{t.manager_email}</div>
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatINR(t.target_amount)}</TableCell>
                        <TableCell className="text-sm">{t.period_month ? `${MONTHS[t.period_month - 1]} ${t.period_year}` : '-'}</TableCell>
                        <TableCell className="text-right text-emerald-600 font-medium text-sm">{formatINR(collected)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <Progress value={pct} className="h-2 flex-1" />
                            <span className="text-xs font-semibold w-9 text-right">{pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            {notesCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs text-primary">
                                <StickyNote className="w-3 h-3" />{notesCount}
                              </span>
                            )}
                            {t.notes && <span className="max-w-[80px] truncate text-xs" title={t.notes}>{t.notes}</span>}
                            {!notesCount && !t.notes && '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setUpdatingTarget(t)}>
                                <DollarSign className="w-4 h-4 mr-2" />Update Progress
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setEditingTarget(t); setShowForm(true); }}>
                                <Pencil className="w-4 h-4 mr-2" />Edit Target
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Delete this target?')) deleteMut.mutate(t.id); }}>
                                <Trash2 className="w-4 h-4 mr-2" />Delete
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
        </TabsContent>
      </Tabs>

      <TargetForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditingTarget(null); }}
        onSave={handleSave}
        editData={editingTarget}
        managers={managers}
        receivableCustomers={receivableCustomers}
        outstandingByName={outstandingByName}
      />
      <UpdateProgressDialog
        open={!!updatingTarget}
        onClose={() => setUpdatingTarget(null)}
        target={updatingTarget}
        currentUser={currentUser}
        onSave={handleProgressSave}
      />
      <BulkEditDialog
        open={showBulkEdit}
        onClose={() => setShowBulkEdit(false)}
        selectedIds={selectedIds}
        targets={targets}
        onSave={handleBulkSave}
        onDelete={handleBulkDelete}
      />
    </div>
  );
}