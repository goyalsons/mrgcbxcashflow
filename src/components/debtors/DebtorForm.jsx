import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EMPTY = { name: '', contact_person: '', email: '', phone: '', gstin: '', address: '', assigned_manager: '', notes: '', status: 'active' };

export default function DebtorForm({ open, onClose, onSave, editData }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });
  // Sales team handles collections/follow-ups; accounts team handles finance — both can be assigned
  const accountManagers = users.filter(u => u.role === 'sales_team' || u.role === 'accounts_team' || u.role === 'account_manager');

  useEffect(() => {
    setForm(editData ? { ...EMPTY, ...editData } : EMPTY);
  }, [editData, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? 'Edit Debtor' : 'New Debtor'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Company / Debtor Name *</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} required placeholder="ABC Pvt Ltd" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Contact Person</Label>
              <Input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>GSTIN</Label>
              <Input value={form.gstin} onChange={e => set('gstin', e.target.value)} placeholder="22AAAAA0000A1Z5" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Assigned Manager</Label>
              {accountManagers.length > 0 ? (
                <Select value={form.assigned_manager} onValueChange={v => set('assigned_manager', v)}>
                  <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>— None —</SelectItem>
                    {accountManagers.map(m => (
                      <SelectItem key={m.id} value={m.email}>
                        {m.full_name || m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.assigned_manager} onChange={e => set('assigned_manager', e.target.value)} placeholder="manager@company.com" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="written_off">Written Off</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Internal notes..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editData ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}