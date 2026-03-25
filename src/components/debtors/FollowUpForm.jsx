import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EMPTY = {
  type: 'call',
  follow_up_date: new Date().toISOString().split('T')[0],
  outcome: '',
  notes: '',
  next_follow_up_date: '',
  promise_date: '',
  promise_amount: '',
};

export default function FollowUpForm({ open, onClose, onSave, debtorId, debtorName }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ ...EMPTY, follow_up_date: new Date().toISOString().split('T')[0] });
  }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      ...form,
      debtor_id: debtorId,
      debtor_name: debtorName,
      promise_amount: form.promise_amount ? parseFloat(form.promise_amount) : null,
    });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Follow-Up — {debtorName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">📞 Call</SelectItem>
                  <SelectItem value="email">📧 Email</SelectItem>
                  <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                  <SelectItem value="visit">🏢 Visit</SelectItem>
                  <SelectItem value="sms">📱 SMS</SelectItem>
                  <SelectItem value="note">📝 Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" value={form.follow_up_date} onChange={e => set('follow_up_date', e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Outcome</Label>
            <Select value={form.outcome} onValueChange={v => set('outcome', v)}>
              <SelectTrigger><SelectValue placeholder="Select outcome..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="promised_payment">Promised Payment</SelectItem>
                <SelectItem value="partial_commitment">Partial Commitment</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
                <SelectItem value="no_response">No Response</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(form.outcome === 'promised_payment' || form.outcome === 'partial_commitment') && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Promise Date</Label>
                <Input type="date" value={form.promise_date} onChange={e => set('promise_date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Promise Amount (₹)</Label>
                <Input type="number" value={form.promise_amount} onChange={e => set('promise_amount', e.target.value)} min="0" />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Notes *</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="What was discussed?" required />
          </div>
          <div className="space-y-1.5">
            <Label>Next Follow-Up Date</Label>
            <Input type="date" value={form.next_follow_up_date} onChange={e => set('next_follow_up_date', e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Log Follow-Up'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}