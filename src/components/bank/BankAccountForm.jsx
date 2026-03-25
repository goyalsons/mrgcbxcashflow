import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const EMPTY = { bank_name: '', account_number: '', ifsc_code: '', account_type: 'current', balance: '', is_active: true };

export default function BankAccountForm({ open, onClose, onSave, editData }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editData) setForm({ ...EMPTY, ...editData, balance: editData.balance ?? '' });
    else setForm(EMPTY);
  }, [editData, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, balance: Number(form.balance) || 0 });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editData ? 'Edit Bank Account' : 'Add Bank Account'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Bank Name *</Label>
            <Input value={form.bank_name} onChange={e => setForm(f => ({...f, bank_name: e.target.value}))} placeholder="e.g. State Bank of India" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Account Number *</Label>
              <Input value={form.account_number} onChange={e => setForm(f => ({...f, account_number: e.target.value}))} required />
            </div>
            <div className="space-y-1.5">
              <Label>IFSC Code</Label>
              <Input value={form.ifsc_code} onChange={e => setForm(f => ({...f, ifsc_code: e.target.value}))} placeholder="SBIN0001234" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Account Type</Label>
              <Select value={form.account_type} onValueChange={v => setForm(f => ({...f, account_type: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="overdraft">Overdraft</SelectItem>
                  <SelectItem value="fixed_deposit">Fixed Deposit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Balance (₹)</Label>
              <Input type="number" step="0.01" value={form.balance} onChange={e => setForm(f => ({...f, balance: e.target.value}))} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({...f, is_active: v}))} />
            <Label>Active</Label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : (editData ? 'Update' : 'Add')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}