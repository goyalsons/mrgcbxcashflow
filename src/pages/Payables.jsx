import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR, formatDateIN, daysUntilDue } from '@/lib/utils/currency';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, Search, Upload, ChevronUp, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import PayableForm from '@/components/payables/PayableForm';
import { useToast } from '@/components/ui/use-toast';

export default function Payables() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: null, dir: 'asc' });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: payables = [], isLoading } = useQuery({
    queryKey: ['payables'],
    queryFn: () => base44.entities.Payable.list('-created_date'),
  });

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

  const totalOutstanding = payables
    .filter(p => p.status !== 'paid')
    .reduce((sum, p) => sum + ((p.amount || 0) - (p.amount_paid || 0)), 0);

  const filtered = useMemo(() => {
    return payables.filter(p => {
      const matchSearch = !search ||
        (p.bill_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.vendor_name || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || p.status === filterStatus;
      const matchCategory = filterCategory === 'all' || p.category === filterCategory;
      return matchSearch && matchStatus && matchCategory;
    });
  }, [payables, search, filterStatus, filterCategory]);

  const sortedFiltered = useMemo(() => {
    if (!sortConfig.key) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortConfig.key], bv = b[sortConfig.key];
      const c = typeof av === 'number' ? av - bv : String(av||'').localeCompare(String(bv||''));
      return sortConfig.dir === 'asc' ? c : -c;
    });
  }, [filtered, sortConfig]);

  function getISOWeek(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const w1 = new Date(d.getFullYear(), 0, 4);
    return `W${1 + Math.round(((d - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7)}`;
  }
  function getDueMonth(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  }

  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payables"
        subtitle={`Outstanding: ${formatINR(totalOutstanding)}`}
        actionLabel="New Payable"
        onAction={() => { setEditing(null); setShowForm(true); }}
      >
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/csv-import?type=payable')}>
          <Upload className="w-4 h-4" /> Bulk Import
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by vendor or bill #..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="partially_paid">Partially Paid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
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
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium text-primary">{selectedIds.size} payable{selectedIds.size > 1 ? 's' : ''} selected</span>
          <Button size="sm" className="gap-1.5 h-7" onClick={async () => { for (const id of selectedIds) await updateMut.mutateAsync({ id, data: { status: 'paid', amount_paid: payables.find(p => p.id === id)?.amount || 0 } }); setSelectedIds(new Set()); toast({ title: 'Marked as paid' }); }}>Mark as Paid</Button>
          <Button size="sm" variant="destructive" className="gap-1.5 h-7" onClick={async () => { if (!confirm(`Delete ${selectedIds.size} payables?`)) return; for (const id of selectedIds) await deleteMut.mutateAsync(id); setSelectedIds(new Set()); }}>
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setSelectedIds(new Set())}>Clear</Button>
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
          <div className="overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow>
                  <TableHead className="w-10 px-2">
                    <input type="checkbox" checked={sortedFiltered.length > 0 && sortedFiltered.every(p => selectedIds.has(p.id))} onChange={() => { const allSel = sortedFiltered.every(p => selectedIds.has(p.id)); setSelectedIds(prev => { const n = new Set(prev); sortedFiltered.forEach(p => allSel ? n.delete(p.id) : n.add(p.id)); return n; }); }} className="rounded border-input w-4 h-4 cursor-pointer" />
                  </TableHead>
                  {[['bill_number','Bill #'],['vendor_name','Vendor'],['category','Category'],['amount','Amount'],['amount_paid','Paid'],['','Balance'],['due_date','Due Date'],['','Due Week'],['','Due Month'],['status','Status'],['','Actions']].map(([col, label]) => col ? (
                    <TableHead key={col+label} className="cursor-pointer select-none whitespace-nowrap sticky top-0 bg-card z-10 shadow-sm" onClick={() => col && setSortConfig(s => ({ key: col, dir: s.key === col && s.dir === 'asc' ? 'desc' : 'asc' }))}>
                      <span className="inline-flex items-center gap-1">{label}<span className={sortConfig.key === col ? 'opacity-100 text-primary' : 'opacity-30'}>{sortConfig.key === col && sortConfig.dir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}</span></span>
                    </TableHead>
                  ) : <TableHead key={label} className="sticky top-0 bg-card z-10 shadow-sm">{label}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFiltered.map((p) => {
                  const balance = (p.amount || 0) - (p.amount_paid || 0);
                  const days = (() => { if (!p.due_date) return null; return Math.floor((new Date(p.due_date) - new Date()) / 86400000); })();
                  return (
                    <TableRow key={p.id} className="group">
                      <TableCell className="px-2" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded border-input w-4 h-4 cursor-pointer" />
                      </TableCell>
                      <TableCell className="font-medium">{p.bill_number || '-'}</TableCell>
                      <TableCell>{p.vendor_name}</TableCell>
                      <TableCell className="capitalize text-muted-foreground text-sm">{p.category?.replace(/_/g, ' ') || '-'}</TableCell>
                      <TableCell className="text-right font-medium">{(p.amount||0).toLocaleString('en-IN', {style:'currency',currency:'INR',maximumFractionDigits:0})}</TableCell>
                      <TableCell className="text-right text-emerald-600">{(p.amount_paid||0).toLocaleString('en-IN', {style:'currency',currency:'INR',maximumFractionDigits:0})}</TableCell>
                      <TableCell className="text-right font-semibold">{balance.toLocaleString('en-IN', {style:'currency',currency:'INR',maximumFractionDigits:0})}</TableCell>
                      <TableCell>
                        <div>
                          <span className="text-sm">{p.due_date ? new Date(p.due_date).toLocaleDateString('en-IN') : '—'}</span>
                          {days !== null && days < 0 && p.status !== 'paid' && (
                            <span className="block text-xs text-red-500">{Math.abs(days)}d overdue</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><span className="text-xs text-muted-foreground">{getISOWeek(p.due_date)}</span></TableCell>
                      <TableCell><span className="text-xs text-muted-foreground whitespace-nowrap">{getDueMonth(p.due_date)}</span></TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
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
        )}
      </Card>

      <PayableForm open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} onSave={handleSave} editData={editing} />
    </div>
  );
}