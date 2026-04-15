import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Target } from 'lucide-react';

export default function SetTargetModal({ customer, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = new Date();

  const [form, setForm] = useState({
    target_amount: customer?.credit_limit || '',
    target_date: today.toISOString().split('T')[0],
    notes: '',
  });
  const [selectedManagerEmail, setSelectedManagerEmail] = useState(customer?.account_manager || '');
  const [checking, setChecking] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => base44.entities.User.list(),
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.CollectionTarget.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-targets'] });
      toast({ title: 'Collection target set successfully' });
      onClose();
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedManagerEmail) {
      toast({ title: 'Please assign a manager first', variant: 'destructive' });
      return;
    }
    const selectedUser = users.find(u => u.email === selectedManagerEmail);
    const managerName = selectedUser?.full_name || selectedManagerEmail;

    const date = new Date(form.target_date);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    // Save manager to Customer if changed
    if (selectedManagerEmail !== customer.account_manager && customer.id) {
      await base44.entities.Customer.update(customer.id, {
        account_manager: selectedManagerEmail,
        account_manager_name: managerName,
      });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
    }

    // Check for duplicate: same customer + same month/year
    setChecking(true);
    const existing = await base44.entities.CollectionTarget.filter({
      customer_name: customer.name,
      period_month: month,
      period_year: year,
    });
    setChecking(false);

    if (existing.length > 0) {
      toast({
        title: 'Duplicate target',
        description: `A target for ${customer.name} already exists for ${date.toLocaleString('default', { month: 'long' })} ${year}.`,
        variant: 'destructive',
      });
      return;
    }

    createMut.mutate({
      manager_email: selectedManagerEmail,
      manager_name: managerName,
      customer_name: customer.name,
      target_amount: parseFloat(form.target_amount),
      target_date: form.target_date,
      period_month: month,
      period_year: year,
      notes: form.notes || `Target for ${customer.name} by ${form.target_date}`,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Set Collection Target
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="font-medium">{customer?.name}</div>
          </div>

          <div>
            <Label>Assign Manager</Label>
            <Select value={selectedManagerEmail} onValueChange={setSelectedManagerEmail}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a manager..." />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.email} value={u.email}>
                    {u.full_name} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedManagerEmail && (
              <p className="text-xs text-destructive mt-1">Please select a manager to set a target.</p>
            )}
          </div>

          <div>
            <Label>Target Amount (₹)</Label>
            <Input
              type="number"
              min="0"
              placeholder="e.g. 500000"
              value={form.target_amount}
              onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label>Target Date</Label>
            <Input
              type="date"
              value={form.target_date}
              onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Input
              placeholder="e.g. Q1 recovery target"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="mt-1"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMut.isPending || checking || !selectedManagerEmail}>
              {checking ? 'Checking...' : createMut.isPending ? 'Saving...' : 'Set Target'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}