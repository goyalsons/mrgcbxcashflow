import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const ASSET_TYPES = [
  { value: 'fixed_deposit', label: 'Fixed Deposit' },
  { value: 'mutual_fund', label: 'Mutual Fund' },
  { value: 'investment', label: 'Investment' },
  { value: 'stocks', label: 'Stocks' },
  { value: 'bonds', label: 'Bonds' },
  { value: 'other', label: 'Other' },
];

const today = new Date().toISOString().split('T')[0];
const EMPTY = { name: '', type: 'fixed_deposit', institution: '', account_number: '', amount: '', maturity_date: '', interest_rate: '', snapshot_date: today, notes: '' };

export default function FinancialAssetForm({ open, onClose, onSave, editData }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editData) setForm({ ...EMPTY, ...editData, amount: editData.amount ?? '', interest_rate: editData.interest_rate ?? '' });
    else setForm({ ...EMPTY, snapshot_date: new Date().toISOString().split('T')[0] });
  }, [editData, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      ...form,
      amount: parseFloat(form.amount) || 0,
      interest_rate: form.interest_rate ? parseFloat(form.interest_rate) : undefined,
    });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editData ? 'Edit Financial Asset' : 'Add Financial Asset'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. SBI FD, HDFC MF" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Current Value (₹) *</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Institution</Label>
              <Input value={form.institution} onChange={e => set('institution', e.target.value)} placeholder="e.g. SBI, HDFC" />
            </div>
            <div className="space-y-1.5">
              <Label>Account/Folio No.</Label>
              <Input value={form.account_number} onChange={e => set('account_number', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Maturity Date</Label>
              <Input type="date" value={form.maturity_date} onChange={e => set('maturity_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Interest/Return %</Label>
              <Input type="number" step="0.01" value={form.interest_rate} onChange={e => set('interest_rate', e.target.value)} placeholder="e.g. 7.5" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Valuation Date</Label>
            <Input type="date" value={form.snapshot_date} onChange={e => set('snapshot_date', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editData ? 'Update' : 'Add Asset'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}