import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EMPTY = { invoice_number: '', amount: '', invoice_date: '', due_date: '', description: '', notes: '', status: 'pending' };

export default function InvoiceForm({ open, onClose, onSave, editData, debtorId, debtorName }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(editData ? { ...EMPTY, ...editData, amount: editData.amount ?? '' } : EMPTY);
  }, [editData, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, debtor_id: debtorId, debtor_name: debtorName, amount: parseFloat(form.amount) || 0 });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editData ? 'Edit Invoice' : 'New Invoice'} — {debtorName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Invoice # *</Label>
              <Input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} placeholder="INV-001" required />
            </div>
            <div className="space-y-1.5">
              <Label>Amount (₹) *</Label>
              <Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} required min="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Invoice Date</Label>
              <Input type="date" value={form.invoice_date} onChange={e => set('invoice_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date *</Label>
              <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="written_off">Written Off</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Description of goods/services" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editData ? 'Update' : 'Add Invoice'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}