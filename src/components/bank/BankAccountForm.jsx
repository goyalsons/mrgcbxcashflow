import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const EMPTY = { name: '', balance: '', is_active: true };

export default function BankAccountForm({ open, onClose, onSave, editData }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editData) setForm({ name: editData.name || '', balance: editData.balance ?? '', is_active: editData.is_active ?? true });
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
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{editData ? 'Edit Balance' : 'Add Balance'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Main Cash, Petty Cash, Savings" required />
          </div>
          <div className="space-y-1.5">
            <Label>Balance (₹) *</Label>
            <Input type="number" step="0.01" value={form.balance} onChange={e => setForm(f => ({...f, balance: e.target.value}))} placeholder="0.00" required />
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