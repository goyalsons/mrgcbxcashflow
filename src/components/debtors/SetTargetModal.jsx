import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Target } from 'lucide-react';

export default function SetTargetModal({ debtor, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = new Date();

  const [form, setForm] = useState({
    target_amount: '',
    period_month: today.getMonth() + 1,
    period_year: today.getFullYear(),
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
    if (!debtor.assigned_manager) {
      toast({ title: 'No manager assigned to this debtor', variant: 'destructive' });
      return;
    }
    createMut.mutate({
      manager_email: debtor.assigned_manager,
      manager_name: debtor.assigned_manager,
      target_amount: parseFloat(form.target_amount),
      period_month: parseInt(form.period_month),
      period_year: parseInt(form.period_year),
      notes: form.notes || `Target for ${debtor.name}`,
    });
  };

  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

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
            <div className="font-medium">{debtor.name}</div>
            <div className="text-muted-foreground mt-0.5">
              Manager: <span className="font-medium text-foreground">{debtor.assigned_manager || 'Not assigned'}</span>
            </div>
          </div>

          {!debtor.assigned_manager && (
            <p className="text-sm text-destructive">This debtor has no assigned manager. Please assign one first.</p>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Month</Label>
              <select
                value={form.period_month}
                onChange={e => setForm(f => ({ ...f, period_month: e.target.value }))}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {months.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Year</Label>
              <Input
                type="number"
                min="2020"
                max="2030"
                value={form.period_year}
                onChange={e => setForm(f => ({ ...f, period_year: e.target.value }))}
                className="mt-1"
              />
            </div>
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
            <Button type="submit" disabled={createMut.isPending || !debtor.assigned_manager}>
              {createMut.isPending ? 'Saving...' : 'Set Target'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}