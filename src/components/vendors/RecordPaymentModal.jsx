import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

const PAYMENT_MODES = ['cash', 'bank_transfer', 'upi', 'cheque', 'neft', 'rtgs', 'imps'];

export default function RecordPaymentModal({ open, onClose, payable }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'bank_transfer',
    reference_number: '',
    notes: '',
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: () => base44.entities.BankAccount.list(),
  });

  const [bankAccountId, setBankAccountId] = useState('');

  const mut = useMutation({
    mutationFn: async (data) => {
      // Log the supplier payment
      await base44.entities.SupplierPayment.create(data);
      // Update the payable's amount_paid and status
      if (payable) {
        const newPaid = (payable.amount_paid || 0) + Number(data.amount);
        const newStatus = newPaid >= payable.amount ? 'paid' : newPaid > 0 ? 'partially_paid' : payable.status;
        await base44.entities.Payable.update(payable.id, {
          amount_paid: newPaid,
          status: newStatus,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierPayments'] });
      queryClient.invalidateQueries({ queryKey: ['payables'] });
      toast({ title: 'Payment recorded successfully' });
      onClose();
      setForm({ amount: '', payment_date: new Date().toISOString().split('T')[0], payment_mode: 'bank_transfer', reference_number: '', notes: '' });
    },
  });

  if (!payable) return null;
  const balance = (payable.amount || 0) - (payable.amount_paid || 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    mut.mutate({
      vendor_id: payable.vendor_id || '',
      vendor_name: payable.vendor_name,
      payable_id: payable.id,
      bill_number: payable.bill_number || '',
      amount: Number(form.amount),
      payment_date: form.payment_date,
      payment_mode: form.payment_mode,
      reference_number: form.reference_number,
      bank_account_id: bankAccountId,
      notes: form.notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {payable.vendor_name} · {payable.bill_number || 'Bill'} · Balance: ₹{balance.toLocaleString('en-IN')}
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Amount Paid *</Label>
            <Input
              type="number"
              placeholder={`Max ₹${balance.toLocaleString('en-IN')}`}
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              max={balance}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Payment Date *</Label>
            <Input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label>Payment Mode</Label>
            <Select value={form.payment_mode} onValueChange={v => setForm(f => ({ ...f, payment_mode: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m.replace(/_/g, ' ').toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {bankAccounts.length > 0 && (
            <div className="space-y-1.5">
              <Label>Bank Account</Label>
              <Select value={bankAccountId} onValueChange={setBankAccountId}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Reference / UTR Number</Label>
            <Input value={form.reference_number} onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))} placeholder="Transaction reference" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? 'Saving...' : 'Record Payment'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}