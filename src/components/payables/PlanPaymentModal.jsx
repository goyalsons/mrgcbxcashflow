import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatINR } from '@/lib/utils/currency';

export default function PlanPaymentModal({ open, onClose, selectedBills }) {
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  const total = selectedBills.reduce((s, p) => s + ((p.amount || 0) - (p.amount_paid || 0)), 0);

  const handleConfirm = () => {
    onClose({ paymentDate, note });
    setNote('');
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Plan Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
            <p className="font-medium">{selectedBills.length} bill{selectedBills.length > 1 ? 's' : ''} selected</p>
            <p className="text-muted-foreground">Total: <span className="font-bold text-foreground">{formatINR(total)}</span></p>
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1">
            {selectedBills.map(b => (
              <div key={b.id} className="flex justify-between text-xs text-muted-foreground px-1">
                <span>{b.vendor_name} {b.bill_number ? `(${b.bill_number})` : ''}</span>
                <span>{formatINR((b.amount || 0) - (b.amount_paid || 0))}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payDate">Payment Date</Label>
            <Input id="payDate" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payNote">Note (optional)</Label>
            <Input id="payNote" placeholder="e.g. Batch payment via NEFT" value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(null)}>Cancel</Button>
          <Button onClick={handleConfirm}>Confirm Plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}