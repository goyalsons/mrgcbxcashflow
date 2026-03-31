import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR } from '@/lib/utils/currency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, Wallet, Landmark, PiggyBank, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import BalanceForm from '@/components/bank/BalanceForm';
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

  const { data: receivables = [] } = useQuery({
    queryKey: ['receivables'],
    queryFn: () => base44.entities.Receivable.list(),
  });
  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list(),
  });
  const { data: payables = [] } = useQuery({
    queryKey: ['payables'],
    queryFn: () => base44.entities.Payable.list(),
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list(),
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.BankAccount.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bankAccounts'] }); setShowForm(false); toast({ title: 'Balance added' }); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BankAccount.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bankAccounts'] }); setShowForm(false); setEditing(null); toast({ title: 'Balance updated' }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.BankAccount.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bankAccounts'] }); toast({ title: 'Balance deleted' }); },
  });

  const handleSave = async (formData) => {
    if (editing) await updateMut.mutateAsync({ id: editing.id, data: formData });
    else await createMut.mutateAsync(formData);
  };

  // Compute per-account balance from transactions
  const computedBalances = useMemo(() => {
    const map = {};
    accounts.forEach(a => {
      const base = a.balance || 0;
      // Inflows: receivables amount_received, payments amount
      const recIn = receivables.filter(r => r.bank_account_id === a.id).reduce((s, r) => s + (r.amount_received || 0), 0);
      const payIn = payments.filter(p => p.bank_account_id === a.id).reduce((s, p) => s + (p.amount || 0), 0);
      // Outflows: payables amount_paid, expenses amount
      const payOut = payables.filter(p => p.bank_account_id === a.id).reduce((s, p) => s + (p.amount_paid || 0), 0);
      const expOut = expenses.filter(e => e.bank_account_id === a.id).reduce((s, e) => s + (e.amount || 0), 0);
      const totalIn = recIn + payIn;
      const totalOut = payOut + expOut;
      map[a.id] = { computed: base + totalIn - totalOut, totalIn, totalOut };
    });
    return map;
  }, [accounts, receivables, payments, payables, expenses]);

  const totalBalance = accounts.reduce((sum, a) => sum + (computedBalances[a.id]?.computed || 0), 0);
  const bankTotal = accounts.filter(a => a.type === 'bank').reduce((sum, a) => sum + (computedBalances[a.id]?.computed || 0), 0);
  const cashTotal = accounts.filter(a => a.type === 'cash').reduce((sum, a) => sum + (computedBalances[a.id]?.computed || 0), 0);
  const bankCount = accounts.filter(a => a.type === 'bank').length;
  const cashCount = accounts.filter(a => a.type === 'cash').length;

  if (isLoading) return <div className="p-12 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Balances"
        subtitle="Bank and cash balance overview"
        actionLabel="Add Balance"
        onAction={() => { setEditing(null); setShowForm(true); }}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Total Balance</p>
              <PiggyBank className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-foreground">{formatINR(totalBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Bank Accounts</p>
              <Landmark className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-foreground">{formatINR(bankTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">{bankCount} account{bankCount !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Cash on Hand</p>
              <Wallet className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-foreground">{formatINR(cashTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">{cashCount} source{cashCount !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
      </div>

      {/* Balance List */}
      {accounts.length === 0 ? (
        <EmptyState
          title="No balances recorded"
          description="Add your bank and cash balances to start tracking."
          actionLabel="Add Balance"
          onAction={() => setShowForm(true)}
          icon={Wallet}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((a) => {
            const Icon = a.type === 'cash' ? Wallet : Landmark;
            return (
              <Card key={a.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${a.type === 'cash' ? 'bg-amber-50 text-amber-600' : 'bg-primary/10 text-primary'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{a.name}</h3>
                        <p className="text-xs text-muted-foreground capitalize">{a.type === 'cash' ? 'Cash' : 'Bank'}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(a); setShowForm(true); }}><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { if (confirm('Delete this balance?')) deleteMut.mutate(a.id); }} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="text-2xl font-bold">{formatINR(computedBalances[a.id]?.computed || 0)}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <ArrowDownCircle className="w-3.5 h-3.5" />
                      {formatINR(computedBalances[a.id]?.totalIn || 0)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-red-500">
                      <ArrowUpCircle className="w-3.5 h-3.5" />
                      {formatINR(computedBalances[a.id]?.totalOut || 0)}
                    </span>
                  </div>
                  {a.is_active === false && <p className="text-xs text-muted-foreground mt-1">Inactive</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <BalanceForm open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} onSave={handleSave} editData={editing} />
    </div>
  );
}