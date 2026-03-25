import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatINR, formatDateIN } from '@/lib/utils/currency';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

const EMPTY = {
  amount: '',
  payment_date: new Date().toISOString().split('T')[0],
  payment_mode: 'bank_transfer',
  reference_number: '',
  notes: '',
  invoice_id: '',
  next_follow_up_date: '',
};

export default function PaymentReceiptModal({ open, onClose, onSave, debtorId, debtorName, invoices = [], outstanding = 0 }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ ...EMPTY, payment_date: new Date().toISOString().split('T')[0] });
  }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const selectedInv = invoices.find(i => i.id === form.invoice_id);
  const invBalance = selectedInv ? (selectedInv.amount || 0) - (selectedInv.amount_paid || 0) : 0;
  const payAmount = parseFloat(form.amount) || 0;
  const remainingAfter = selectedInv ? Math.max(0, invBalance - payAmount) : Math.max(0, outstanding - payAmount);
  const isFullyPaid = payAmount > 0 && remainingAfter === 0;
  const isPartial = payAmount > 0 && remainingAfter > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      debtor_id: debtorId,
      debtor_name: debtorName,
      invoice_number: selectedInv?.invoice_number || '',
      amount: payAmount,
    };
    // Remove next_follow_up_date from payment record (it's used for follow-up prompt only)
    delete payload.next_follow_up_date;
    await onSave(payload);
    setSaving(false);
  };

  const unpaidInvoices = invoices.filter(i => i.status !== 'paid');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Payment Receipt — {debtorName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Invoice selector */}
          <div className="space-y-1.5">
            <Label>Allocate to Invoice (optional)</Label>
            <Select value={form.invoice_id} onValueChange={v => set('invoice_id', v)}>
              <SelectTrigger><SelectValue placeholder="Unallocated / General Payment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Unallocated</SelectItem>
                {unpaidInvoices.map(inv => (
                  <SelectItem key={inv.id} value={inv.id}>
                    {inv.invoice_number || 'No #'} — {formatINR((inv.amount || 0) - (inv.amount_paid || 0))} due
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedInv && (
              <Card className="bg-muted/40 border-none">
                <CardContent className="p-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Invoice balance</span>
                  <span className="font-semibold">{formatINR(invBalance)}</span>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                required min="0.01" step="0.01"
                max={selectedInv ? invBalance : undefined}
                placeholder="0.00"
              />
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
              <Label>Reference # (UTR / Cheque)</Label>
              <Input value={form.reference_number} onChange={e => set('reference_number', e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Optional remarks..." />
          </div>

          {/* Payment outcome preview */}
          {payAmount > 0 && (
            <div className={`flex items-start gap-3 p-3 rounded-lg border ${isFullyPaid ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              {isFullyPaid
                ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                : <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              }
              <div className="flex-1">
                {isFullyPaid ? (
                  <p className="text-sm font-semibold text-emerald-700">
                    {selectedInv ? 'Invoice will be marked as Paid!' : 'Debtor will be marked as fully Paid!'}
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-amber-700">
                      Partial Payment — {formatINR(remainingAfter)} still outstanding
                    </p>
                    <div className="mt-2 space-y-1">
                      <Label className="text-xs text-amber-700">Schedule next follow-up date</Label>
                      <Input
                        type="date"
                        value={form.next_follow_up_date}
                        onChange={e => set('next_follow_up_date', e.target.value)}
                        className="bg-white"
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Recording...' : 'Record Payment'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}