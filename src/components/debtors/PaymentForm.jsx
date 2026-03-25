import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EMPTY = { amount: '', payment_date: new Date().toISOString().split('T')[0], payment_mode: 'bank_transfer', reference_number: '', notes: '', invoice_id: '' };

export default function PaymentForm({ open, onClose, onSave, debtorId, debtorName, invoices = [] }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ ...EMPTY, payment_date: new Date().toISOString().split('T')[0] });
  }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const selectedInv = invoices.find(i => i.id === form.invoice_id);
    await onSave({
      ...form,
      debtor_id: debtorId,
      debtor_name: debtorName,
      invoice_number: selectedInv?.invoice_number || '',
      amount: parseFloat(form.amount) || 0,
    });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment — {debtorName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Allocate to Invoice (optional)</Label>
            <Select value={form.invoice_id} onValueChange={v => set('invoice_id', v)}>
              <SelectTrigger><SelectValue placeholder="Unallocated / General" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Unallocated</SelectItem>
                {invoices.filter(i => i.status !== 'paid').map(inv => (
                  <SelectItem key={inv.id} value={inv.id}>
                    {inv.invoice_number} — ₹{(inv.amount - (inv.amount_paid || 0)).toLocaleString('en-IN')} due
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Amount (₹) *</Label>
              <Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} required min="0.01" step="0.01" />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Date *</Label>
              <Input type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Payment Mode</Label>
              <Select value={form.payment_mode} onValueChange={v => set('payment_mode', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="neft">NEFT</SelectItem>
                  <SelectItem value="rtgs">RTGS</SelectItem>
                  <SelectItem value="imps">IMPS</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reference #</Label>
              <Input value={form.reference_number} onChange={e => set('reference_number', e.target.value)} placeholder="UTR / Cheque No." />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Record Payment'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}