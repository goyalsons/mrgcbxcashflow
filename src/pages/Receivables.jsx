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
import { MoreHorizontal, Pencil, Trash2, Search } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import ReceivableForm from '@/components/receivables/ReceivableForm';
import { useToast } from '@/components/ui/use-toast';

export default function Receivables() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: receivables = [], isLoading } = useQuery({
    queryKey: ['receivables'],
    queryFn: () => base44.entities.Receivable.list('-created_date'),
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

  const totalOutstanding = receivables
    .filter(r => r.status !== 'paid' && r.status !== 'written_off')
    .reduce((sum, r) => sum + ((r.amount || 0) - (r.amount_received || 0)), 0);

  const filtered = useMemo(() => {
    return receivables.filter(r => {
      const matchSearch = !search ||
        (r.invoice_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.customer_name || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || r.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [receivables, search, filterStatus]);

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

      <Card>
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Loading...</div>
        ) : receivables.length === 0 ? (
          <EmptyState
            title="No receivables yet"
            description="Start tracking money owed to your business"
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
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const balance = (r.amount || 0) - (r.amount_received || 0);
                  const days = daysUntilDue(r.due_date);
                  return (
                    <TableRow key={r.id} className="group">
                      <TableCell className="font-medium">{r.invoice_number || '-'}</TableCell>
                      <TableCell>{r.customer_name}</TableCell>
                      <TableCell className="text-right font-medium">{formatINR(r.amount)}</TableCell>
                      <TableCell className="text-right text-emerald-600">{formatINR(r.amount_received)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatINR(balance)}</TableCell>
                      <TableCell>
                        <div>
                          <span className="text-sm">{formatDateIN(r.due_date)}</span>
                          {days !== null && days < 0 && r.status !== 'paid' && (
                            <span className="block text-xs text-red-500">{Math.abs(days)} days overdue</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(r)}>
                              <Pencil className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(r.id)} className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
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
      </Card>

      <ReceivableForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSave={handleSave}
        editData={editing}
      />
    </div>
  );
}