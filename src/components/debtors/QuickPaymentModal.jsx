import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { formatINR } from '@/lib/utils/currency';
import { Loader2, PlusCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export default function QuickPaymentModal({ debtor, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState('bank_transfer');

  const outstanding = debtor.total_outstanding || 0;

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Payment.create({
        debtor_id: debtor.id,
        debtor_name: debtor.name,
        amount: amt,
        payment_date: date,
        payment_mode: mode,
      });
      // Update debtor totals
      await base44.entities.Debtor.update(debtor.id, {
        total_received: (debtor.total_received || 0) + amt,
        total_outstanding: Math.max(0, outstanding - amt),
      });
      queryClient.invalidateQueries({ queryKey: ['debtors'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast({ title: `Payment of ${formatINR(amt)} recorded` });
      onClose();
    } catch (err) {
      toast({ title: `Failed: ${err.message}`, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-emerald-600" /> Record Payment — {debtor.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="p-3 bg-muted/40 rounded-lg text-sm flex justify-between">
            <span className="text-muted-foreground">Outstanding</span>
            <span className="font-bold text-red-600">{formatINR(outstanding)}</span>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Payment Amount (₹)</Label>
            <Input
              type="number"
              placeholder={`Max: ${outstanding}`}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Payment Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Payment Method</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="neft">NEFT</SelectItem>
                <SelectItem value="rtgs">RTGS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {amount && parseFloat(amount) > 0 && (
            <div className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-3 py-2">
              New outstanding after payment: <span className="font-bold">{formatINR(Math.max(0, outstanding - parseFloat(amount)))}</span>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !amount}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              {saving ? 'Saving...' : 'Record Payment'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}