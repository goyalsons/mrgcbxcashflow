import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

export default function EditInvoiceModal({ invoice, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    amount: invoice.amount,
    due_date: invoice.due_date,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await base44.entities.Invoice.update(invoice.id, {
        amount: parseFloat(form.amount),
        due_date: form.due_date,
      });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Invoice updated successfully' });
      onClose();
    } catch (err) {
      toast({ title: `Error: ${err.message}`, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Invoice</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="font-medium">{invoice.debtor_name}</div>
            <div className="text-muted-foreground mt-0.5">Invoice: {invoice.invoice_number}</div>
          </div>

          <div>
            <Label>Amount (₹)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label>Due Date</Label>
            <Input
              type="date"
              value={form.due_date}
              onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              required
              className="mt-1"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}