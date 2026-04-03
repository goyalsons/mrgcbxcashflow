import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const today = new Date().toISOString().split('T')[0];
const nowTime = new Date().toTimeString().slice(0, 5);
const EMPTY = { name: '', type: 'bank', account_number: '', balance: '', snapshot_date: today, snapshot_time: nowTime, is_active: true };

export default function BalanceForm({ open, onClose, onSave, editData }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = new Date().toISOString().split('T')[0];
    const tm = new Date().toTimeString().slice(0, 5);
    if (editData) setForm({ ...EMPTY, ...editData, balance: editData.balance ?? '', snapshot_date: t, snapshot_time: tm });
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
            <Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Main Cash, Petty Cash" required />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({...f, type: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Account Number</Label>
            <Input value={form.account_number} onChange={e => setForm(f => ({...f, account_number: e.target.value}))} placeholder="e.g. 1234567890" />
          </div>
          <div className="space-y-1.5">
            <Label>Balance (₹) *</Label>
            <Input type="number" step="0.01" value={form.balance} onChange={e => setForm(f => ({...f, balance: e.target.value}))} placeholder="0.00" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Snapshot Date</Label>
              <Input type="date" value={form.snapshot_date} onChange={e => setForm(f => ({...f, snapshot_date: e.target.value}))} />
            </div>
            <div className="space-y-1.5">
              <Label>Snapshot Time</Label>
              <Input type="time" value={form.snapshot_time} onChange={e => setForm(f => ({...f, snapshot_time: e.target.value}))} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({...f, is_active: v}))} />
            <Label>Active</Label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : (editData ? 'Update' : 'Add Balance')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}