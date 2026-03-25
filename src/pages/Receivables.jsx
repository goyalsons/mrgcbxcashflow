import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR, formatDateIN, daysUntilDue } from '@/lib/utils/currency';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, Search } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import ReceivableForm from '@/components/receivables/ReceivableForm';
import QuickActionBar from '@/components/receivables/QuickActionPanel';
import { useToast } from '@/components/ui/use-toast';

export default function Receivables() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: receivables = [], isLoading } = useQuery({
    queryKey: ['receivables'],
    queryFn: () => base44.entities.Receivable.list('-created_date'),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date'),
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Receivable.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['receivables'] }); setShowForm(false); toast({ title: 'Receivable created' }); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Receivable.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['receivables'] }); setShowForm(false); setEditing(null); toast({ title: 'Receivable updated' }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Receivable.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['receivables'] }); toast({ title: 'Receivable deleted' }); },
  });

  const handleSave = async (formData) => {
    if (editing) await updateMut.mutateAsync({ id: editing.id, data: formData });
    else await createMut.mutateAsync(formData);
  };

  const handleEdit = (item) => { setEditing(item); setShowForm(true); };
  const handleDelete = (id) => { if (confirm('Delete this receivable?')) deleteMut.mutate(id); };

  // Filter to unpaid invoices only
  const unpaidReceivables = useMemo(() =>
    receivables.filter(r => r.status !== 'paid' && r.status !== 'written_off'),
    [receivables]
  );

  const totalOutstanding = unpaidReceivables
    .reduce((sum, r) => sum + ((r.amount || 0) - (r.amount_received || 0)), 0);

  // Group by customer
  const customerGroups = useMemo(() => {
    const groups = {};
    unpaidReceivables.forEach(r => {
      const key = r.customer_name || 'Unknown';
      if (!groups[key]) {
        groups[key] = {
          customer_name: key,
          customer_email: r.customer_email,
          customer_phone: r.customer_phone,
          customer_id: r.customer_id,
          invoices: [],
          total_amount: 0,
          total_received: 0,
        };
      }
      groups[key].invoices.push(r);
      groups[key].total_amount += r.amount || 0;
      groups[key].total_received += r.amount_received || 0;
    });
    return Object.values(groups);
  }, [unpaidReceivables]);

  // Filter customer groups
  const filtered = useMemo(() => {
    return customerGroups.filter(group => {
      const matchSearch = !search ||
        group.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        group.invoices.some(inv => 
          (inv.invoice_number || '').toLowerCase().includes(search.toLowerCase())
        );
      const matchStatus = filterStatus === 'all' || 
        group.invoices.some(inv => inv.status === filterStatus);
      return matchSearch && matchStatus;
    });
  }, [customerGroups, search, filterStatus]);

  // Selection helpers - select all invoices in filtered groups
  const allFilteredInvoices = filtered.flatMap(g => g.invoices);
  const allFilteredIds = allFilteredInvoices.map(r => r.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id));
  const someSelected = allFilteredIds.some(id => selected.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(prev => { const next = new Set(prev); allFilteredIds.forEach(id => next.delete(id)); return next; });
    } else {
      setSelected(prev => new Set([...prev, ...allFilteredIds]));
    }
  };
  const toggleOne = (id) => {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const selectedReceivables = allFilteredInvoices.filter(r => selected.has(r.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receivables"
        subtitle={`Outstanding: ${formatINR(totalOutstanding)}`}
        actionLabel="New Receivable"
        onAction={() => { setEditing(null); setShowForm(true); }}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by customer or invoice #..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="partially_paid">Partially Paid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="written_off">Written Off</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg px-4 py-2">
          <span className="font-medium text-primary">{selected.size} invoice{selected.size > 1 ? 's' : ''} selected</span>
          <span className="text-muted-foreground">— send reminders, log follow-ups, or record calls</span>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-destructive underline">Clear</button>
        </div>
      )}

      <Card>
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Loading...</div>
        ) : unpaidReceivables.length === 0 ? (
          <EmptyState
            title="No unpaid receivables"
            description="All invoices are paid or written off"
            actionLabel="Add Receivable"
            onAction={() => setShowForm(true)}
          />
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">No results match your filters</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                      className="translate-y-0.5"
                    />
                  </TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Invoices</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((group) => {
                  const balance = group.total_amount - group.total_received;
                  const isExpanded = expandedId === group.customer_name;
                  return (
                    <React.Fragment key={group.customer_name}>
                      <TableRow 
                        className="cursor-pointer group hover:bg-muted/50"
                        onClick={() => setExpandedId(isExpanded ? null : group.customer_name)}
                      >
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={group.invoices.every(inv => selected.has(inv.id))}
                            onCheckedChange={() => {
                              const allInvoiceIds = group.invoices.map(inv => inv.id);
                              const allChecked = allInvoiceIds.every(id => selected.has(id));
                              setSelected(prev => {
                                const next = new Set(prev);
                                if (allChecked) {
                                  allInvoiceIds.forEach(id => next.delete(id));
                                } else {
                                  allInvoiceIds.forEach(id => next.add(id));
                                }
                                return next;
                              });
                            }}
                            aria-label="Select customer"
                            className="translate-y-0.5"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{group.customer_name}</TableCell>
                        <TableCell className="text-right font-medium">{formatINR(group.total_amount)}</TableCell>
                        <TableCell className="text-right text-emerald-600">{formatINR(group.total_received)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatINR(balance)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{group.invoices.length} invoice{group.invoices.length !== 1 ? 's' : ''}</TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs"
                            onClick={() => setExpandedId(isExpanded ? null : group.customer_name)}
                          >
                            {isExpanded ? '−' : '+'}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan="7" className="p-4">
                            <div className="space-y-2">
                              {group.invoices.map(inv => {
                                const balance = (inv.amount || 0) - (inv.amount_received || 0);
                                const days = daysUntilDue(inv.due_date);
                                const isSelected = selected.has(inv.id);
                                return (
                                  <div key={inv.id} className={`flex items-center justify-between text-sm bg-background rounded p-3 border ${isSelected ? 'bg-primary/5 border-primary/30' : ''}`}>
                                    <div className="flex items-center gap-3 flex-1">
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => toggleOne(inv.id)}
                                        className="translate-y-0"
                                      />
                                      <div>
                                        <p className="font-medium">{inv.invoice_number}</p>
                                        <p className="text-xs text-muted-foreground">Due: {formatDateIN(inv.due_date)}</p>
                                        {days !== null && days < 0 && (
                                          <p className="text-xs text-red-500">{Math.abs(days)} days overdue</p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold">{formatINR(balance)}</p>
                                      <StatusBadge status={inv.status} />
                                    </div>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7">
                                          <MoreHorizontal className="w-3.5 h-3.5" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleEdit(inv)}>
                                          <Pencil className="w-4 h-4 mr-2" /> Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDelete(inv.id)} className="text-destructive">
                                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                );
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <ReceivableForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSave={handleSave}
        editData={editing}
      />

      <QuickActionBar
        selectedReceivables={selectedReceivables}
        onClear={() => setSelected(new Set())}
      />
    </div>
  );
}