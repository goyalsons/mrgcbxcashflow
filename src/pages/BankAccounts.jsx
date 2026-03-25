import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR } from '@/lib/utils/currency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, Landmark } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import BankAccountForm from '@/components/bank/BankAccountForm';
import { useToast } from '@/components/ui/use-toast';

export default function BankAccounts() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: () => base44.entities.BankAccount.list(),
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.BankAccount.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bankAccounts'] }); setShowForm(false); toast({ title: 'Account added' }); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BankAccount.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bankAccounts'] }); setShowForm(false); setEditing(null); toast({ title: 'Account updated' }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.BankAccount.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bankAccounts'] }); toast({ title: 'Account deleted' }); },
  });

  const handleSave = async (formData) => {
    if (editing) await updateMut.mutateAsync({ id: editing.id, data: formData });
    else await createMut.mutateAsync(formData);
  };

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  if (isLoading) return <div className="p-12 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank Accounts"
        subtitle={`Total Balance: ${formatINR(totalBalance)}`}
        actionLabel="Add Account"
        onAction={() => { setEditing(null); setShowForm(true); }}
      />

      {accounts.length === 0 ? (
        <EmptyState title="No bank accounts" description="Add your business bank accounts to track balances" actionLabel="Add Account" onAction={() => setShowForm(true)} icon={Landmark} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((a) => (
            <Card key={a.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10">
                      <Landmark className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{a.bank_name}</h3>
                      <p className="text-xs text-muted-foreground">A/C: ****{a.account_number?.slice(-4)}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditing(a); setShowForm(true); }}><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { if (confirm('Delete?')) deleteMut.mutate(a.id); }} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold">{formatINR(a.balance)}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize text-xs">{a.account_type?.replace(/_/g, ' ')}</Badge>
                    {a.ifsc_code && <span className="text-xs text-muted-foreground">{a.ifsc_code}</span>}
                    {a.is_active === false && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BankAccountForm open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} onSave={handleSave} editData={editing} />
    </div>
  );
}