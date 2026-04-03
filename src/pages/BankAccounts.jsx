import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatINR } from '@/lib/utils/currency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MoreHorizontal, Pencil, Trash2, Wallet, Landmark, PiggyBank, Plus, TrendingUp } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import BalanceForm from '@/components/bank/BalanceForm';
import FinancialAssetForm from '@/components/bank/FinancialAssetForm';
import { useToast } from '@/components/ui/use-toast';

const ASSET_TYPE_LABELS = {
  fixed_deposit: 'Fixed Deposit',
  mutual_fund: 'Mutual Fund',
  investment: 'Investment',
  stocks: 'Stocks',
  bonds: 'Bonds',
  other: 'Other',
};

export default function BankAccounts() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: () => base44.entities.BankAccount.list('-updated_date', 500),
  });

  const { data: financialAssets = [] } = useQuery({
    queryKey: ['financialAssets'],
    queryFn: () => base44.entities.FinancialAsset.list('-snapshot_date', 200),
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.BankAccount.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bankAccounts'] }); setShowForm(false); toast({ title: 'Balance snapshot added' }); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BankAccount.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bankAccounts'] }); setShowForm(false); setEditing(null); toast({ title: 'Balance updated' }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.BankAccount.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bankAccounts'] }); toast({ title: 'Snapshot deleted' }); },
  });

  const assetCreateMut = useMutation({
    mutationFn: (data) => base44.entities.FinancialAsset.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['financialAssets'] }); setShowAssetForm(false); toast({ title: 'Asset added' }); },
  });
  const assetUpdateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FinancialAsset.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['financialAssets'] }); setShowAssetForm(false); setEditingAsset(null); toast({ title: 'Asset updated' }); },
  });
  const assetDeleteMut = useMutation({
    mutationFn: (id) => base44.entities.FinancialAsset.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['financialAssets'] }); toast({ title: 'Asset deleted' }); },
  });

  const handleSave = async (formData) => {
    if (editing) await updateMut.mutateAsync({ id: editing.id, data: formData });
    else await createMut.mutateAsync(formData);
  };

  const handleAssetSave = async (formData) => {
    if (editingAsset) await assetUpdateMut.mutateAsync({ id: editingAsset.id, data: formData });
    else await assetCreateMut.mutateAsync(formData);
  };

  // Group accounts by account_number (or by name+type if no account_number), pick latest snapshot per group
  const latestSnapshots = useMemo(() => {
    const groups = {};
    accounts.forEach(a => {
      const key = a.account_number ? `acc_${a.account_number}` : `name_${a.name}_${a.type}`;
      const existing = groups[key];
      if (!existing) {
        groups[key] = a;
      } else {
        // Compare by snapshot_date + snapshot_time
        const existingDT = `${existing.snapshot_date || ''}${existing.snapshot_time || ''}`;
        const newDT = `${a.snapshot_date || ''}${a.snapshot_time || ''}`;
        if (newDT > existingDT) groups[key] = a;
      }
    });
    return Object.values(groups);
  }, [accounts]);

  const bankSnapshots = latestSnapshots.filter(a => a.type === 'bank');
  const cashSnapshots = latestSnapshots.filter(a => a.type === 'cash');

  const bankTotal = bankSnapshots.reduce((s, a) => s + (a.balance || 0), 0);
  const cashTotal = cashSnapshots.reduce((s, a) => s + (a.balance || 0), 0);
  const assetsTotal = financialAssets.reduce((s, a) => s + (a.amount || 0), 0);
  const grandTotal = bankTotal + cashTotal + assetsTotal;

  if (isLoading) return <div className="p-12 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank Accounts & Assets"
        subtitle="Track balances across bank accounts, cash, and other financial assets"
        actionLabel="Add Balance Snapshot"
        onAction={() => { setEditing(null); setShowForm(true); }}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground flex items-center gap-2"><PiggyBank className="w-4 h-4" /> Grand Total</p>
            <p className="text-2xl font-bold mt-1">{formatINR(grandTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Landmark className="w-4 h-4" /> Bank Accounts</p>
            <p className="text-2xl font-bold mt-1">{formatINR(bankTotal)}</p>
            <p className="text-xs text-muted-foreground">{bankSnapshots.length} account{bankSnapshots.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Wallet className="w-4 h-4" /> Cash on Hand</p>
            <p className="text-2xl font-bold mt-1">{formatINR(cashTotal)}</p>
            <p className="text-xs text-muted-foreground">{cashSnapshots.length} source{cashSnapshots.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Other Assets</p>
            <p className="text-2xl font-bold mt-1">{formatINR(assetsTotal)}</p>
            <p className="text-xs text-muted-foreground">{financialAssets.length} asset{financialAssets.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Bank & Cash Accounts</TabsTrigger>
          <TabsTrigger value="assets">Other Financial Assets</TabsTrigger>
          <TabsTrigger value="history">All Snapshots</TabsTrigger>
        </TabsList>

        {/* Latest Snapshots per Account */}
        <TabsContent value="accounts" className="mt-4">
          {latestSnapshots.length === 0 ? (
            <EmptyState title="No accounts recorded" description="Add your first balance snapshot." actionLabel="Add Balance" onAction={() => setShowForm(true)} icon={Wallet} />
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Account Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Snapshot Date</TableHead>
                    <TableHead>Snapshot Time</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {latestSnapshots.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">{a.account_number || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{a.type === 'cash' ? 'Cash' : 'Bank'}</Badge></TableCell>
                      <TableCell className="text-sm">{a.snapshot_date || '—'}</TableCell>
                      <TableCell className="text-sm">{a.snapshot_time || '—'}</TableCell>
                      <TableCell className="text-right font-semibold">{formatINR(a.balance || 0)}</TableCell>
                      <TableCell>{a.is_active === false ? <Badge variant="secondary">Inactive</Badge> : <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditing(a); setShowForm(true); }}><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { if (confirm('Delete this snapshot?')) deleteMut.mutate(a.id); }} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Financial Assets */}
        <TabsContent value="assets" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => { setEditingAsset(null); setShowAssetForm(true); }} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Asset
            </Button>
          </div>
          {financialAssets.length === 0 ? (
            <EmptyState title="No financial assets recorded" description="Add FDs, mutual funds, investments, etc." actionLabel="Add Asset" onAction={() => setShowAssetForm(true)} icon={TrendingUp} />
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Institution</TableHead>
                    <TableHead>Account/Folio</TableHead>
                    <TableHead>Maturity Date</TableHead>
                    <TableHead>Rate %</TableHead>
                    <TableHead>Valuation Date</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {financialAssets.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell><Badge variant="outline">{ASSET_TYPE_LABELS[a.type] || a.type}</Badge></TableCell>
                      <TableCell className="text-sm">{a.institution || '—'}</TableCell>
                      <TableCell className="font-mono text-sm">{a.account_number || '—'}</TableCell>
                      <TableCell className="text-sm">{a.maturity_date || '—'}</TableCell>
                      <TableCell className="text-sm">{a.interest_rate != null ? `${a.interest_rate}%` : '—'}</TableCell>
                      <TableCell className="text-sm">{a.snapshot_date || '—'}</TableCell>
                      <TableCell className="text-right font-semibold">{formatINR(a.amount || 0)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditingAsset(a); setShowAssetForm(true); }}><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { if (confirm('Delete this asset?')) assetDeleteMut.mutate(a.id); }} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Full History */}
        <TabsContent value="history" className="mt-4">
          {accounts.length === 0 ? (
            <EmptyState title="No snapshots yet" description="Add balance snapshots to see history." icon={Landmark} />
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Account Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Snapshot Date</TableHead>
                    <TableHead>Snapshot Time</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...accounts].sort((a, b) => {
                    const aDT = `${a.snapshot_date || ''}${a.snapshot_time || ''}`;
                    const bDT = `${b.snapshot_date || ''}${b.snapshot_time || ''}`;
                    return bDT.localeCompare(aDT);
                  }).map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="font-mono text-sm">{a.account_number || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{a.type === 'cash' ? 'Cash' : 'Bank'}</Badge></TableCell>
                      <TableCell className="text-sm">{a.snapshot_date || '—'}</TableCell>
                      <TableCell className="text-sm">{a.snapshot_time || '—'}</TableCell>
                      <TableCell className="text-right font-semibold">{formatINR(a.balance || 0)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (confirm('Delete this snapshot?')) deleteMut.mutate(a.id); }}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <BalanceForm open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} onSave={handleSave} editData={editing} />
      <FinancialAssetForm open={showAssetForm} onClose={() => { setShowAssetForm(false); setEditingAsset(null); }} onSave={handleAssetSave} editData={editingAsset} />
    </div>
  );
}