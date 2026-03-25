import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR, formatDateIN, daysUntilDue } from '@/lib/utils/currency';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import PayableForm from '@/components/payables/PayableForm';
import { useToast } from '@/components/ui/use-toast';

export default function Payables() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payables"
        subtitle={`Outstanding: ${formatINR(totalOutstanding)}`}
        actionLabel="New Payable"
        onAction={() => { setEditing(null); setShowForm(true); }}
      />

      <Card>
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Loading...</div>
        ) : payables.length === 0 ? (
          <EmptyState title="No payables yet" description="Track bills and payments to vendors" actionLabel="Add Payable" onAction={() => setShowForm(true)} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payables.map((p) => {
                  const balance = (p.amount || 0) - (p.amount_paid || 0);
                  const days = daysUntilDue(p.due_date);
                  return (
                    <TableRow key={p.id} className="group">
                      <TableCell className="font-medium">{p.bill_number || '-'}</TableCell>
                      <TableCell>{p.vendor_name}</TableCell>
                      <TableCell className="capitalize text-muted-foreground text-sm">{p.category?.replace(/_/g, ' ') || '-'}</TableCell>
                      <TableCell className="text-right font-medium">{formatINR(p.amount)}</TableCell>
                      <TableCell className="text-right text-emerald-600">{formatINR(p.amount_paid)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatINR(balance)}</TableCell>
                      <TableCell>
                        <div>
                          <span className="text-sm">{formatDateIN(p.due_date)}</span>
                          {days !== null && days < 0 && p.status !== 'paid' && (
                            <span className="block text-xs text-red-500">{Math.abs(days)} days overdue</span>
                          )}
                        </div>
                      </TableCell>
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