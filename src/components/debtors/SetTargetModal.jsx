import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.CollectionTarget.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-targets'] });
      toast({ title: 'Collection target set successfully' });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!customer?.account_manager) {
      toast({ title: 'No manager assigned to this customer', variant: 'destructive' });
      return;
    }
    const date = new Date(form.target_date);
    createMut.mutate({
      manager_email: customer.account_manager,
      manager_name: customer.account_manager_name || customer.account_manager,
      customer_name: customer.name,
      target_amount: parseFloat(form.target_amount),
      target_date: form.target_date,
      period_month: date.getMonth() + 1,
      period_year: date.getFullYear(),
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
            <div className="text-muted-foreground mt-0.5">
              Manager: <span className="font-medium text-foreground">{customer?.account_manager_name || customer?.account_manager || 'Not assigned'}</span>
            </div>
          </div>

          {!customer?.account_manager && (
            <p className="text-sm text-destructive">This customer has no assigned manager. Please assign one first.</p>
          )}

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
            <Button type="submit" disabled={createMut.isPending || !customer?.account_manager}>
              {createMut.isPending ? 'Saving...' : 'Set Target'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}