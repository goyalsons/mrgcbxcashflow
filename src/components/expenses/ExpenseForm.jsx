import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { Paperclip, X, Loader2, FileText, AlertTriangle } from 'lucide-react';

const CATEGORIES = [
  { value: 'travel', label: 'Travel' },
  { value: 'office_supplies', label: 'Office Supplies' },
  { value: 'meals', label: 'Meals' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'rent', label: 'Rent' },
  { value: 'salary', label: 'Salary' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'software', label: 'Software' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'miscellaneous', label: 'Miscellaneous' },
];

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'cheque', label: 'Cheque' },
];

const RECURRENCE_TYPES = [
  { value: 'none', label: 'No Recurrence' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'custom', label: 'Custom' },
];

const RECURRENCE_UNITS = [
  { value: 'day', label: 'Day(s)' },
  { value: 'week', label: 'Week(s)' },
  { value: 'month', label: 'Month(s)' },
  { value: 'year', label: 'Year(s)' },
];

const EMPTY = {
  description: '', amount: '', expense_date: '', category: '',
  payment_mode: '', notes: '', receipt_url: '',
  recurrence_type: 'none', recurrence_interval: 1, recurrence_unit: 'month',
  recurrence_start_date: '', recurrence_end_date: '',
};

function isImageUrl(url) {
  return url && /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
}

export default function ExpenseForm({ open, onClose, onSave, editData, approvalThreshold, forceRecurring }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    if (editData) setForm({ ...EMPTY, ...editData, amount: editData.amount || '' });
    else setForm(EMPTY);
  }, [editData, open]);

  const amount = Number(form.amount) || 0;
  const needsApproval = !editData && approvalThreshold > 0 && amount > approvalThreshold;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, receipt_url: file_url }));
    setUploading(false);
    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, amount: Number(form.amount) });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? 'Edit Expense' : 'New Expense'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="What was this expense for?" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Amount (₹) *</Label>
              <Input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" value={form.expense_date} onChange={e => setForm(f => ({...f, expense_date: e.target.value}))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({...f, category: v}))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Mode</Label>
              <Select value={form.payment_mode} onValueChange={v => setForm(f => ({...f, payment_mode: v}))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={2} />
          </div>

          {/* Receipt Upload */}
          <div className="space-y-1.5">
            <Label>Receipt / Invoice</Label>
            {form.receipt_url ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/40">
                {isImageUrl(form.receipt_url) ? (
                  <img src={form.receipt_url} alt="Receipt" className="w-12 h-12 object-cover rounded border" />
                ) : (
                  <div className="w-12 h-12 flex items-center justify-center bg-muted rounded border">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <a href={form.receipt_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate block">
                    View attachment
                  </a>
                </div>
                <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setForm(f => ({ ...f, receipt_url: '' }))}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Paperclip className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Click to attach receipt</span>
                    <span className="text-xs text-muted-foreground">PDF, PNG, JPG supported</span>
                  </div>
                )}
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
          </div>

          {/* Approval warning banner */}
          {needsApproval && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                This expense exceeds the approval threshold of <strong>₹{approvalThreshold?.toLocaleString('en-IN')}</strong>. It will be sent for admin approval before being recorded.
              </p>
            </div>
          )}

          {/* Recurrence */}
          <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
            <div className="space-y-1.5">
              <Label>Recurrence</Label>
              <Select
                value={form.recurrence_type || 'none'}
                onValueChange={v => setForm(f => ({ ...f, recurrence_type: v }))}
                disabled={!!editData && !forceRecurring}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(forceRecurring ? RECURRENCE_TYPES.filter(r => r.value !== 'none') : RECURRENCE_TYPES).map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.recurrence_type && form.recurrence_type !== 'none' && (
              <>
                {form.recurrence_type === 'custom' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Every</Label>
                      <Input type="number" min="1" value={form.recurrence_interval} onChange={e => setForm(f => ({...f, recurrence_interval: Number(e.target.value)}))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Unit</Label>
                      <Select value={form.recurrence_unit} onValueChange={v => setForm(f => ({...f, recurrence_unit: v}))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{RECURRENCE_UNITS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>End Date (optional)</Label>
                  <Input type="date" value={form.recurrence_end_date} onChange={e => setForm(f => ({...f, recurrence_end_date: e.target.value}))} />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || uploading}>
              {saving ? 'Submitting...' : editData ? 'Update' : needsApproval ? 'Submit for Approval' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
    </Dialog>
  );
}