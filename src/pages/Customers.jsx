/**
 * Customers.jsx
 * © 2025 CEOITBOX Tech Services LLP. All rights reserved.
 * https://www.ceoitbox.com
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, Search, Upload, UserCheck, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import ContactForm from '@/components/contacts/ContactForm';
import { useToast } from '@/components/ui/use-toast';
import { isSalesTeam } from '@/lib/utils/roles';

const ITEMS_PER_PAGE = 50;

export default function Customers() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningManager, setAssigningManager] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [managerFilter, setManagerFilter] = useState('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date'),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Customer.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setShowForm(false); toast({ title: 'Customer added' }); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setShowForm(false); setEditing(null); toast({ title: 'Customer updated' }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Customer.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); toast({ title: 'Customer deleted' }); },
  });

  const handleSave = async (formData) => {
    if (editing) await updateMut.mutateAsync({ id: editing.id, data: formData });
    else await createMut.mutateAsync(formData);
  };

  const handleBulkAssign = async () => {
    if (!assigningManager || selected.size === 0) return;
    setAssigning(true);
    const mgr = users.find(u => u.email === assigningManager);
    const mgrName = mgr ? mgr.full_name : assigningManager;
    await Promise.all([...selected].map(id =>
      base44.entities.Customer.update(id, { account_manager: assigningManager, account_manager_name: mgrName })
    ));
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    toast({ title: `Account manager assigned to ${selected.size} customer(s)` });
    setSelected(new Set());
    setAssigningManager('');
    setShowAssignModal(false);
    setAssigning(false);
  };

  const toggleOne = (id) => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(c => c.id)));
  };

  const filtered = useMemo(() => {
    let result = customers;

    // Account Managers (sales_team) only see their assigned customers
    if (isSalesTeam(currentUser?.role) && currentUser?.email) {
      result = result.filter(c => c.account_manager === currentUser.email);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.contact_person || '').toLowerCase().includes(q)
      );
    }

    if (managerFilter === '__unassigned__') {
      result = result.filter(c => !c.account_manager);
    } else if (managerFilter !== 'all') {
      result = result.filter(c => c.account_manager === managerFilter);
    }
    result.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      if (sortBy === 'credit_limit') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      aVal = String(aVal || '').toLowerCase();
      bVal = String(bVal || '').toLowerCase();
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return result;
  }, [customers, search, sortBy, sortDir, managerFilter, currentUser]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const SortHeader = ({ label, col }) => (
    <TableHead className="cursor-pointer hover:bg-muted/50 select-none" onClick={() => toggleSort(col)}>
      <div className="flex items-center gap-1.5 font-semibold">
        {label}
        {sortBy === col ? (
          sortDir === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
        ) : (
          <ArrowUpDown className="w-4 h-4 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" subtitle={`${customers.length} customers`} actionLabel="Add Customer" onAction={() => { setEditing(null); setShowForm(true); }}>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/csv-import?type=customer')}>
          <Upload className="w-4 h-4" /> Bulk Import
        </Button>
      </PageHeader>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/30 rounded-lg px-4 py-3">
          <span className="text-sm font-semibold text-accent">{selected.size} customer{selected.size > 1 ? 's' : ''} selected</span>
          <Button size="sm" className="gap-1.5 ml-auto bg-accent hover:bg-accent/90 text-white" onClick={() => setShowAssignModal(true)}>
            <UserCheck className="w-4 h-4" /> Assign Account Manager
          </Button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-accent/70 hover:text-accent underline">Clear</button>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
          <Input placeholder="Search customers..." value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} className="pl-9 border-primary/20 focus:border-primary" />
        </div>
        {!isSalesTeam(currentUser?.role) && (
          <Select value={managerFilter} onValueChange={v => { setManagerFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All Account Managers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Account Managers</SelectItem>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {users.filter(u => u.role === 'sales_team' || u.role === 'admin').map(u => (
                <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-slate-50/50">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Loading...</div>
        ) : customers.length === 0 ? (
          <EmptyState title="No customers yet" description="Add your customers to track receivables" actionLabel="Add Customer" onAction={() => setShowForm(true)} />
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">No customers match your search</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-slate-50 shadow-sm border-b-2 border-slate-200">
                <TableRow className="hover:bg-slate-50/80">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <SortHeader label="Company" col="name" />
                  <SortHeader label="Contact Person" col="contact_person" />
                  <SortHeader label="Email" col="email" />
                  <SortHeader label="Phone" col="phone" />
                  <SortHeader label="Address" col="address" />
                  <SortHeader label="State" col="state" />
                  <SortHeader label="Country" col="country" />
                  <SortHeader label="GSTIN" col="gstin" />
                  <SortHeader label="Credit Limit" col="credit_limit" />
                  <SortHeader label="Account Manager" col="account_manager_name" />
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((c, idx) => (
                  <TableRow key={c.id} className={`group hover:bg-primary/5 border-slate-200/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} />
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900">{c.name}</TableCell>
                    <TableCell className="text-slate-700">{c.contact_person || <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-slate-600">{c.email || <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-slate-700">{c.phone || <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-xs text-slate-600 max-w-[150px] truncate">{c.address || <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-slate-700">{c.state || <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-slate-700">{c.country || <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-xs text-slate-600 font-mono">{c.gstin || <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-sm font-medium text-slate-900">{c.credit_limit ? `₹${Number(c.credit_limit).toLocaleString('en-IN')}` : <span className="text-slate-400 text-xs">No limit</span>}</TableCell>
                    <TableCell>
                      {c.account_manager_name
                        ? <Badge variant="secondary" className="text-xs bg-accent/10 text-accent hover:bg-accent/20">{c.account_manager_name}</Badge>
                        : <span className="text-slate-400 text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 hover:bg-primary/10"><MoreHorizontal className="w-4 h-4 text-primary" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(c); setShowForm(true); }}><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { if (confirm('Delete?')) deleteMut.mutate(c.id); }} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
              {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/30">
                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages} • Showing {paginatedData.length} of {filtered.length} customers</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>First</Button>
                  <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>Previous</Button>
                  <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>Next</Button>
                  <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>Last</Button>
                </div>
              </div>
              )}
              {search && <div className="px-4 py-3 border-t text-xs text-muted-foreground">Showing {filtered.length} of {customers.length}</div>}
              </div>
              )}
              </Card>

      <ContactForm open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} onSave={handleSave} editData={editing} type="Customer" />

      {/* Bulk Assign Account Manager Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Account Manager</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Assign an account manager to <strong>{selected.size}</strong> selected customer(s).
          </p>
          <Select value={assigningManager} onValueChange={setAssigningManager}>
            <SelectTrigger>
              <SelectValue placeholder="Select account manager..." />
            </SelectTrigger>
            <SelectContent>
              {users.map(u => (
                <SelectItem key={u.id} value={u.email}>
                  {u.full_name} <span className="text-muted-foreground text-xs ml-1">({u.email})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>Cancel</Button>
            <Button onClick={handleBulkAssign} disabled={!assigningManager || assigning}>
              {assigning ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}