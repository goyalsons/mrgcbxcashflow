import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Medal, Target, TrendingUp, Plus, Pencil, Trash2, MoreHorizontal, Award } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const EMPTY = {
  debtor_id: '',
  manager_email: '',
  manager_name: '',
  target_amount: '',
  target_date: new Date().toISOString().split('T')[0],
  notes: '',
};

function TargetForm({ open, onClose, onSave, editData, managers, debtors }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (editData) {
      setForm({
        ...editData,
        target_amount: editData.target_amount?.toString() || '',
        target_date: editData.target_date || new Date().toISOString().split('T')[0],
      });
    } else {
      setForm({ ...EMPTY, target_date: new Date().toISOString().split('T')[0] });
    }
  }, [editData, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleDebtorSelect = (debtorId) => {
    const debtor = debtors.find(d => d.id === debtorId);
    if (!debtor) return;
    const mgr = managers.find(m => m.email === debtor.assigned_manager);
    setForm(f => ({
      ...f,
      debtor_id: debtorId,
      manager_email: debtor.assigned_manager || '',
      manager_name: mgr?.full_name || debtor.assigned_manager || '',
      target_amount: debtor.total_outstanding > 0 ? String(debtor.total_outstanding) : f.target_amount,
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editData ? 'Edit Target' : 'Assign Collection Target'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editData && (
            <div className="space-y-1.5">
              <Label>Debtor</Label>
              <Select value={form.debtor_id} onValueChange={handleDebtorSelect}>
                <SelectTrigger><SelectValue placeholder="Select debtor..." /></SelectTrigger>
                <SelectContent>
                  {debtors.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Account Manager *</Label>
            <div className="flex h-9 w-full rounded-md border border-input bg-muted/40 px-3 py-1 text-sm items-center">
              {form.manager_name || form.manager_email || <span className="text-muted-foreground">Auto-filled from debtor</span>}
            </div>
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
            <Button type="submit" disabled={saving || !form.manager_email}>{saving ? 'Saving...' : editData ? 'Update Target' : 'Assign Target'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RankIcon({ rank }) {
  if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
  if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
  return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">#{rank}</span>;
}

export default function CollectionTargets() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: targets = [], isLoading } = useQuery({
    queryKey: ['collectionTargets'],
    queryFn: () => base44.entities.CollectionTarget.list('-created_date'),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: debtors = [] } = useQuery({
    queryKey: ['debtors'],
    queryFn: () => base44.entities.Debtor.list(),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['allPayments'],
    queryFn: () => base44.entities.Payment.list('-payment_date'),
  });

  const managers = useMemo(() => allUsers.filter(u => u.role === 'account_manager' || u.role === 'admin'), [allUsers]);

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

  // Calculate actual collected per manager from payments for the period
  const monthlyTargets = useMemo(() => {
    const filtered = targets.filter(t => t.period_month === selectedMonth && t.period_year === selectedYear);

    return filtered.map(t => {
      // Collected = sum of payments by debtors assigned to this manager in this month
      const managerDebtorIds = debtors.filter(d => d.assigned_manager === t.manager_email).map(d => d.id);
      const monthPayments = payments.filter(p => {
        if (!managerDebtorIds.includes(p.debtor_id)) return false;
        if (!p.payment_date) return false;
        const d = new Date(p.payment_date);
        return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
      });
      const collected = monthPayments.reduce((s, p) => s + (p.amount || 0), 0);
      const pct = t.target_amount > 0 ? Math.min(100, Math.round((collected / t.target_amount) * 100)) : 0;
      return { ...t, collected, pct };
    }).sort((a, b) => b.pct - a.pct);
  }, [targets, selectedMonth, selectedYear, debtors, payments]);

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
             <div className="flex justify-between text-xs text-muted-foreground mt-1">
               <span>₹0</span>
               <span>{formatINR(totalTarget)}</span>
             </div>
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
                <Card key={t.id} className={`${idx === 0 ? 'border-yellow-200 bg-yellow-50/40' : ''}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 w-6 flex justify-center">
                        <RankIcon rank={idx + 1} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <span className="text-sm font-semibold">{t.manager_name || t.manager_email}</span>
                            <span className="text-xs text-muted-foreground ml-1">{t.manager_email}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-primary text-sm">{t.pct}%</span>
                          </div>
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
      <div>
        <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-2 flex items-center gap-2">
          <Target className="w-3.5 h-3.5" /> All Targets
        </h2>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Manager</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Week</TableHead>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.map(t => {
                const managerDebtorIds = debtors.filter(d => d.assigned_manager === t.manager_email).map(d => d.id);
                const monthPayments = payments.filter(p => {
                  if (!managerDebtorIds.includes(p.debtor_id)) return false;
                  if (!p.payment_date) return false;
                  const d = new Date(p.payment_date);
                  return d.getMonth() + 1 === t.period_month && d.getFullYear() === t.period_year;
                });
                const collected = monthPayments.reduce((s, p) => s + (p.amount || 0), 0);
                const pct = t.target_amount > 0 ? Math.min(100, Math.round((collected / t.target_amount) * 100)) : 0;
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium">{t.manager_name || t.manager_email}</div>
                      <div className="text-xs text-muted-foreground">{t.manager_email}</div>
                    </TableCell>
                    <TableCell className="text-right">{formatINR(t.target_amount)}</TableCell>
                    <TableCell className="text-sm">{t.target_date ? new Date(t.target_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }).replace('/', '-') : '-'}</TableCell>
                    <TableCell className="text-sm">{t.target_date ? `W${Math.ceil(new Date(t.target_date).getDate() / 7)}` : '-'}</TableCell>
                    <TableCell className="text-sm">{t.period_month ? MONTHS[t.period_month - 1] : '-'}</TableCell>
                    <TableCell className="text-right text-emerald-600 font-medium">{formatINR(collected)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-24">
                        <Progress value={pct} className="h-2 flex-1" />
                        <span className="text-xs font-semibold w-10 text-right">{pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.notes || '-'}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingTarget(t); setShowForm(true); }}>
                            <Pencil className="w-4 h-4 mr-2" />Edit
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
        )}
        </TabsContent>
      </Tabs>

      <TargetForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditingTarget(null); }}
        onSave={handleSave}
        editData={editingTarget}
        managers={managers}
        debtors={debtors}
      />
    </div>
  );
}